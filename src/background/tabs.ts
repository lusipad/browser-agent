import { sleep } from '../shared/util';
import { networkActivity } from './cdp';

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
  status: string;
}

export function tabInfo(t: chrome.tabs.Tab): TabInfo {
  return {
    id: t.id ?? -1,
    url: t.url ?? '',
    title: t.title ?? '',
    active: !!t.active,
    windowId: t.windowId,
    status: t.status ?? 'unknown',
  };
}

export async function listAllTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((t) => t.id != null).map(tabInfo);
}

export async function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    throw new Error(`Tab ${tabId} does not exist (it may have been closed). Call tabs_context for fresh tab ids.`);
  }
}

export async function activeTabIn(windowId: number | null): Promise<chrome.tabs.Tab | null> {
  const q: chrome.tabs.QueryInfo =
    windowId != null ? { active: true, windowId } : { active: true, lastFocusedWindow: true };
  const tabs = await chrome.tabs.query(q);
  return tabs[0] ?? null;
}

/**
 * 等待网络静默：在途请求降到阈值以下并保持安静一小段时间，或超时。
 * 允许少量长连接（分析/SSE/websocket）存在，避免永远等不到 0。
 */
export async function waitForNetworkIdle(
  tabId: number,
  opts: { quietMs?: number; timeoutMs?: number; allow?: number } = {},
): Promise<void> {
  const quietMs = opts.quietMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const allow = opts.allow ?? 0;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { inFlight, sinceLastMs } = networkActivity(tabId);
    if (inFlight <= allow && sinceLastMs >= quietMs) return;
    await sleep(120);
  }
}

/** 等待页面加载完成（DOM complete + 网络静默），含 400ms 的“导航是否发生”宽限期 */
export async function waitForLoad(tabId: number, timeoutMs = 12000): Promise<void> {
  await sleep(400);
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (tab.status !== 'complete') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, timeoutMs);
      function done(): void {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
      function listener(id: number, info: chrome.tabs.TabChangeInfo): void {
        if (id === tabId && info.status === 'complete') done();
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
  // SPA 常在 load 后才发起数据请求 → 再等网络静默（软性，失败不阻塞）
  await waitForNetworkIdle(tabId, { quietMs: 500, timeoutMs: 6000, allow: 0 }).catch(() => {});
  await sleep(200); // 渲染余量
}

/**
 * 把智能体正在操作的标签页归入 “🤖 Agent” 标签组（蓝色），
 * 让用户一眼看到哪些标签正被 AI 控制（复刻 Claude in Chrome 的透明标识）。
 */
export async function addToAgentGroup(windowId: number, tabId: number): Promise<void> {
  try {
    const groups = await chrome.tabGroups.query({ windowId, title: AGENT_GROUP_TITLE });
    if (groups.length) {
      await chrome.tabs.group({ tabIds: tabId, groupId: groups[0].id });
    } else {
      const gid = await chrome.tabs.group({ tabIds: tabId, createProperties: { windowId } });
      await chrome.tabGroups.update(gid, { title: AGENT_GROUP_TITLE, color: 'blue' });
    }
  } catch {
    /* 标签组不可用（如某些窗口类型）时静默忽略 */
  }
}

const AGENT_GROUP_TITLE = '🤖 Agent';

/** 释放控制时撤销 Agent 分组，清除视觉标识（标签页本身保留） */
export async function ungroupAgentTabs(windowId: number): Promise<number> {
  try {
    const groups = await chrome.tabGroups.query({ windowId, title: AGENT_GROUP_TITLE });
    let n = 0;
    for (const g of groups) {
      const tabs = await chrome.tabs.query({ groupId: g.id });
      const ids = tabs.map((t) => t.id).filter((id): id is number => id != null);
      if (ids.length) {
        await chrome.tabs.ungroup(ids);
        n += ids.length;
      }
    }
    return n;
  } catch {
    return 0;
  }
}
