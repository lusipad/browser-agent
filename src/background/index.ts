// Service Worker 入口：面板连接管理、消息路由、会话生命周期
import { computeCost } from '../shared/context';
import { loadConfig, onConfigChange, saveConfig } from '../shared/settings';
import type { AppConfig, ModelPick, PanelToBg } from '../shared/types';
import { runTurn } from './agent';
import { detachAll } from './cdp';
import { pickDiagnoseTab, runDiagnostics } from './diagnose';
import { deleteConversation, listConversations, loadConversation, saveConversation } from './history';
import { Session } from './session';
import { browserTools } from './tools/browser';
import { computerTool } from './tools/computer';
import { devtoolsTools } from './tools/devtools';
import { gifTool } from './tools/gif';
import { pageTools } from './tools/page';
import { registerTools } from './tools/registry';

registerTools([...browserTools, computerTool, ...pageTools, ...devtoolsTools, gifTool]);

// 点击工具栏图标 → 打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    // 首次安装：落盘默认配置并打开设置页
    const cfg = await loadConfig();
    await saveConfig(cfg);
    if (details.reason === 'install') {
      void chrome.runtime.openOptionsPage();
    }
  })();
});

const sessions = new Map<number, Session>();

async function sessionFor(windowId: number): Promise<Session> {
  let s = sessions.get(windowId);
  if (!s) {
    s = await Session.restore(windowId, await loadConfig());
    sessions.set(windowId, s);
  }
  return s;
}

function modelPicks(cfg: AppConfig): ModelPick[] {
  return cfg.models.map((m) => ({
    id: m.id,
    label: m.label,
    vision: m.vision,
    providerName: cfg.providers.find((p) => p.id === m.providerId)?.name ?? m.providerId,
  }));
}

/** 用当前所选模型的计费换算累计成本并推送（token 数不变，仅重算美元） */
function pushUsage(s: Session): void {
  if (s.usage.input + s.usage.output <= 0) return;
  const model = s.cfg.models.find((m) => m.id === s.modelId);
  s.emit({ type: 'usage', input: s.usage.input, output: s.usage.output, cost: computeCost(s.usage, model?.pricing) });
}

/** 推送会话列表（把尚未落盘的当前会话也并入，保证它可见并高亮） */
async function pushConversations(s: Session): Promise<void> {
  const list = await listConversations();
  if (s.messages.length && !list.some((c) => c.id === s.conversationId)) {
    list.unshift({ id: s.conversationId, title: s.title(), updatedAt: Date.now(), msgCount: s.messages.length });
  }
  s.emit({ type: 'conversations', list, activeId: s.conversationId });
}

/** 把当前会话归档（有内容才存） */
async function archiveCurrent(s: Session): Promise<void> {
  if (s.messages.length) await saveConversation(s.toArchived());
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  let bound: Session | null = null;

  port.onMessage.addListener((msg: PanelToBg) => {
    void (async () => {
      try {
        switch (msg.type) {
          case 'hello': {
            const s = await sessionFor(msg.windowId);
            bound = s;
            s.port = port;
            s.cfg = await loadConfig();
            if (!s.cfg.models.find((m) => m.id === s.modelId)) s.modelId = s.cfg.defaultModelId;
            port.postMessage(s.snapshot(modelPicks(s.cfg)));
            pushUsage(s);
            await pushConversations(s);
            break;
          }
          case 'send': {
            if (bound && !bound.running && msg.text.trim()) {
              const s = bound;
              void runTurn(s, msg.text.trim()).then(() => pushConversations(s));
            }
            break;
          }
          case 'continue': {
            // 不追加新用户消息，直接接着已有历史继续执行
            if (bound && !bound.running && bound.messages.some((m) => m.role === 'assistant')) {
              const s = bound;
              void runTurn(s, '', { continuation: true }).then(() => pushConversations(s));
            }
            break;
          }
          case 'abort':
            bound?.abort();
            break;
          case 'new_chat': {
            if (bound && !bound.running) {
              await archiveCurrent(bound);
              bound.reset();
              port.postMessage(bound.snapshot(modelPicks(bound.cfg)));
              pushUsage(bound);
              await pushConversations(bound);
            }
            break;
          }
          case 'switch_conv': {
            if (bound && !bound.running && msg.id !== bound.conversationId) {
              const conv = await loadConversation(msg.id);
              if (conv) {
                await archiveCurrent(bound);
                bound.loadFrom(conv);
                port.postMessage(bound.snapshot(modelPicks(bound.cfg)));
                pushUsage(bound);
                await pushConversations(bound);
              }
            }
            break;
          }
          case 'delete_conv': {
            if (bound) {
              await deleteConversation(msg.id);
              if (msg.id === bound.conversationId && !bound.running) {
                bound.reset();
                port.postMessage(bound.snapshot(modelPicks(bound.cfg)));
                pushUsage(bound);
              }
              await pushConversations(bound);
            }
            break;
          }
          case 'set_model': {
            if (bound && bound.cfg.models.find((m) => m.id === msg.modelId)) {
              bound.modelId = msg.modelId;
              pushUsage(bound); // 新模型计费不同 → 立即重算成本
              void bound.persist();
            }
            break;
          }
          case 'approval':
            bound?.resolveApproval(msg.id, msg.decision);
            break;
          case 'detach': {
            const n = await detachAll();
            bound?.info(`已释放浏览器控制（断开了 ${n} 个标签页的调试连接）。`);
            break;
          }
          case 'open_options':
            void chrome.runtime.openOptionsPage();
            break;
          default:
            break;
        }
      } catch (e) {
        console.error('[browser-agent] panel message error:', e);
      }
    })();
  });

  port.onDisconnect.addListener(() => {
    if (bound && bound.port === port) bound.port = null;
  });
});

// 一次性诊断请求（来自设置页），不走面板长连接
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'diagnose') {
    void (async () => {
      try {
        const tabId = typeof msg.tabId === 'number' ? msg.tabId : await pickDiagnoseTab();
        if (tabId == null) {
          sendResponse({ ok: false, tab: null, checks: [{ name: '目标标签页', status: 'warn', detail: '没有可诊断的 http(s) 网页。先在浏览器里打开一个普通网页，再回来点诊断。' }] });
          return;
        }
        sendResponse(await runDiagnostics(tabId));
      } catch (e) {
        sendResponse({ ok: false, tab: null, checks: [{ name: '诊断', status: 'fail', detail: e instanceof Error ? e.message : String(e) }] });
      }
    })();
    return true; // 异步 sendResponse
  }
  return undefined;
});

// 设置变化时向所有已连接面板广播模型列表
onConfigChange((cfg) => {
  for (const s of sessions.values()) {
    s.cfg = cfg;
    if (!cfg.models.find((m) => m.id === s.modelId)) s.modelId = cfg.defaultModelId;
    s.emit({ type: 'models', models: modelPicks(cfg), modelId: s.modelId });
    pushUsage(s); // 计费可能已改动 → 重算成本
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  const s = sessions.get(windowId);
  if (s) {
    s.abort();
    sessions.delete(windowId);
    void archiveCurrent(s); // 关窗前尽力归档
    void chrome.storage.session.remove('session:' + windowId);
  }
});
