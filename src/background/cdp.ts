// chrome.debugger（CDP）会话管理：可信输入事件、截图、控制台与网络日志缓冲
import { truncate } from '../shared/util';

export interface ConsoleEntry {
  level: string;
  text: string;
  ts: number;
}

export interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  mimeType?: string;
  encodedBytes?: number;
  error?: string;
  finished: boolean;
}

interface TabDebugState {
  attached: boolean;
  console: ConsoleEntry[];
  network: Map<string, NetworkEntry>;
  netOrder: string[];
}

const states = new Map<number, TabDebugState>();
const CONSOLE_CAP = 600;
const NETWORK_CAP = 600;

function stateFor(tabId: number): TabDebugState {
  let s = states.get(tabId);
  if (!s) {
    s = { attached: false, console: [], network: new Map(), netOrder: [] };
    states.set(tabId, s);
  }
  return s;
}

export function send(tabId: number, method: string, params?: Record<string, unknown>): Promise<any> {
  return chrome.debugger.sendCommand({ tabId }, method, params ?? {}) as Promise<any>;
}

export async function ensureAttached(tabId: number): Promise<void> {
  const s = stateFor(tabId);
  if (s.attached) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already attached/i.test(msg) && !/another/i.test(msg)) {
      // 我们自己已附加（如 SW 重启后状态丢失）
    } else if (/another debugger|devtools/i.test(msg)) {
      throw new Error('Cannot control this tab: DevTools or another debugger is attached to it. Ask the user to close DevTools for that tab.');
    } else {
      throw new Error(`Failed to attach debugger to tab ${tabId}: ${msg}`);
    }
  }
  s.attached = true;
  await Promise.allSettled([
    send(tabId, 'Page.enable'),
    send(tabId, 'Runtime.enable'),
    send(tabId, 'Log.enable'),
    send(tabId, 'Network.enable', {}),
    // 窗口失焦时页面仍按“聚焦”渲染，避免 hover/focus 样式丢失
    send(tabId, 'Emulation.setFocusEmulationEnabled', { enabled: true }),
  ]);
}

export async function detachTab(tabId: number): Promise<void> {
  const s = states.get(tabId);
  if (s?.attached) {
    s.attached = false;
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      /* 已被关闭等情况 */
    }
  }
}

export async function detachAll(): Promise<number> {
  let n = 0;
  for (const [tabId, s] of states) {
    if (s.attached) {
      n++;
      await detachTab(tabId);
    }
  }
  return n;
}

/** 在页面主世界执行表达式并取回 JSON 值（用于 javascript_tool 与视口信息） */
export async function evalInPage(tabId: number, expression: string): Promise<any> {
  await ensureAttached(tabId);
  const r = await send(tabId, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (r?.exceptionDetails) {
    const ex = r.exceptionDetails;
    const desc = ex.exception?.description ?? ex.text ?? 'JavaScript exception';
    throw new Error(truncate(String(desc), 1200));
  }
  return r?.result?.value;
}

export function getConsole(tabId: number, pattern?: string, limit = 80): ConsoleEntry[] {
  const s = states.get(tabId);
  if (!s) return [];
  let entries = s.console;
  if (pattern) {
    try {
      const re = new RegExp(pattern, 'i');
      entries = entries.filter((e) => re.test(e.text));
    } catch {
      const p = pattern.toLowerCase();
      entries = entries.filter((e) => e.text.toLowerCase().includes(p));
    }
  }
  return entries.slice(-limit);
}

export function getNetwork(tabId: number, filter?: string, limit = 60): NetworkEntry[] {
  const s = states.get(tabId);
  if (!s) return [];
  let list = s.netOrder.map((id) => s.network.get(id)!).filter(Boolean);
  if (filter) {
    const f = filter.toLowerCase();
    list = list.filter((e) => e.url.toLowerCase().includes(f) || e.resourceType.toLowerCase() === f);
  }
  return list.slice(-limit);
}

export async function getResponseBody(tabId: number, requestId: string): Promise<string> {
  await ensureAttached(tabId);
  const r = await send(tabId, 'Network.getResponseBody', { requestId });
  if (r?.base64Encoded) return `(binary body, base64, ${String(r.body ?? '').length} chars — not shown)`;
  return truncate(String(r?.body ?? ''), 20000);
}

export function clearBuffers(tabId: number): void {
  const s = states.get(tabId);
  if (s) {
    s.console = [];
    s.network.clear();
    s.netOrder = [];
  }
}

function fmtRemote(o: any): string {
  if (o == null) return '';
  if ('value' in o) {
    try {
      return typeof o.value === 'string' ? o.value : JSON.stringify(o.value);
    } catch {
      return String(o.value);
    }
  }
  if (o.unserializableValue) return String(o.unserializableValue);
  if (o.description) return String(o.description);
  return String(o.type ?? '');
}

function pushConsole(s: TabDebugState, level: string, text: string): void {
  s.console.push({ level, text: truncate(text, 600, '…'), ts: Date.now() });
  if (s.console.length > CONSOLE_CAP) s.console.splice(0, s.console.length - CONSOLE_CAP);
}

chrome.debugger.onEvent.addListener((source, method, params: any) => {
  const tabId = source.tabId;
  if (tabId == null) return;
  const s = stateFor(tabId);
  switch (method) {
    case 'Runtime.consoleAPICalled': {
      const text = (params.args ?? []).map(fmtRemote).join(' ');
      pushConsole(s, String(params.type ?? 'log'), text);
      break;
    }
    case 'Runtime.exceptionThrown': {
      const d = params.exceptionDetails ?? {};
      const text = `${d.text ?? 'Uncaught exception'} ${d.exception?.description ?? ''}`.trim();
      pushConsole(s, 'error', text);
      break;
    }
    case 'Log.entryAdded': {
      const e = params.entry ?? {};
      pushConsole(s, String(e.level ?? 'log'), `[${e.source ?? 'log'}] ${e.text ?? ''}`);
      break;
    }
    case 'Network.requestWillBeSent': {
      const id = String(params.requestId);
      if (!s.network.has(id)) {
        s.netOrder.push(id);
        if (s.netOrder.length > NETWORK_CAP) {
          const evict = s.netOrder.shift();
          if (evict) s.network.delete(evict);
        }
      }
      s.network.set(id, {
        requestId: id,
        url: String(params.request?.url ?? ''),
        method: String(params.request?.method ?? 'GET'),
        resourceType: String(params.type ?? 'Other'),
        finished: false,
      });
      break;
    }
    case 'Network.responseReceived': {
      const e = s.network.get(String(params.requestId));
      if (e) {
        e.status = params.response?.status;
        e.mimeType = params.response?.mimeType;
      }
      break;
    }
    case 'Network.loadingFinished': {
      const e = s.network.get(String(params.requestId));
      if (e) {
        e.finished = true;
        e.encodedBytes = Math.round(params.encodedDataLength ?? 0);
      }
      break;
    }
    case 'Network.loadingFailed': {
      const e = s.network.get(String(params.requestId));
      if (e) {
        e.finished = true;
        e.error = String(params.errorText ?? 'failed');
      }
      break;
    }
    default:
      break;
  }
});

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId != null) {
    const s = states.get(source.tabId);
    if (s) s.attached = false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  states.delete(tabId);
});
