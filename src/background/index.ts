// Service Worker 入口：面板连接管理、消息路由、会话生命周期
import { makeT, resolveLang } from '../shared/i18n';
import { loadConfig, onConfigChange, saveConfig } from '../shared/settings';
import type { AppConfig, BindingPick, PanelToBg } from '../shared/types';
import { runTurn } from './agent';
import { detachAll } from './cdp';
import { pickDiagnoseTab, runDiagnostics } from './diagnose';
import { deleteConversation, listConversations, loadConversation, saveConversation } from './history';
import { Session } from './session';
import { defaultEnabledBindingId, isBindingEnabled } from '../shared/models';
import { ungroupAgentTabs } from './tabs';
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

function bindingPicks(cfg: AppConfig): BindingPick[] {
  return cfg.bindings.flatMap((binding) => {
    if (!isBindingEnabled(binding)) return [];
    const model = cfg.models.find((m) => m.id === binding.modelId);
    if (!model) return [];
    return [{
      id: binding.id,
      label: model.label,
      vision: model.vision,
      providerName: cfg.providers.find((p) => p.id === binding.providerId)?.name ?? binding.providerId,
    }];
  });
}

/** 推送按实际请求绑定累计的用量与成本。 */
function pushUsage(s: Session): void {
  if (s.usage.input + s.usage.output <= 0) return;
  s.emit({ type: 'usage', input: s.usage.input, output: s.usage.output, cost: s.usage.cost });
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
            if (!s.cfg.bindings.find((b) => b.id === s.bindingId && isBindingEnabled(b))) s.bindingId = defaultEnabledBindingId(s.cfg);
            port.postMessage(s.snapshot(bindingPicks(s.cfg)));
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
              port.postMessage(bound.snapshot(bindingPicks(bound.cfg)));
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
                port.postMessage(bound.snapshot(bindingPicks(bound.cfg)));
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
                port.postMessage(bound.snapshot(bindingPicks(bound.cfg)));
                pushUsage(bound);
              }
              await pushConversations(bound);
            }
            break;
          }
          case 'set_binding': {
            if (bound && bound.cfg.bindings.find((b) => b.id === msg.bindingId && isBindingEnabled(b))) {
              bound.bindingId = msg.bindingId;
              void bound.persist();
            }
            break;
          }
          case 'set_vision': {
            // 会话级临时视觉配置：true=本轮会话强制开启，false=关闭；新对话时重置为跟随模型
            if (bound) {
              bound.visionOverride = msg.enabled;
              void bound.persist();
              port.postMessage(bound.snapshot(bindingPicks(bound.cfg)));
            }
            break;
          }
          case 'approval':
            bound?.resolveApproval(msg.id, msg.decision);
            break;
          case 'detach': {
            const n = await detachAll();
            if (bound) {
              const ungrouped = await ungroupAgentTabs(bound.windowId);
              bound.groupedTabs.clear();
              bound.info(bound.t('bg.detach', [n, ungrouped]));
            }
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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 纵深防御：只接受本扩展自身页面的消息（无 externally_connectable，但仍显式校验）
  if (sender.id !== chrome.runtime.id) return undefined;
  if (msg?.type === 'diagnose') {
    void (async () => {
      const lang = resolveLang((await loadConfig()).uiLang);
      const dt = makeT(lang);
      try {
        const tabId = typeof msg.tabId === 'number' ? msg.tabId : await pickDiagnoseTab();
        if (tabId == null) {
          sendResponse({ ok: false, tab: null, checks: [{ name: dt('bg.diag.targetTab'), status: 'warn', detail: dt('bg.diag.noHttp') }] });
          return;
        }
        sendResponse(await runDiagnostics(tabId, lang));
      } catch (e) {
        sendResponse({ ok: false, tab: null, checks: [{ name: dt('bg.diag.title'), status: 'fail', detail: e instanceof Error ? e.message : String(e) }] });
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
    if (!cfg.bindings.find((b) => b.id === s.bindingId && isBindingEnabled(b))) s.bindingId = defaultEnabledBindingId(cfg);
    s.emit({ type: 'bindings', bindings: bindingPicks(cfg), bindingId: s.bindingId });
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
