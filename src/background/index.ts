// Service Worker 入口：面板连接管理、消息路由、会话生命周期
import { loadConfig, onConfigChange, saveConfig } from '../shared/settings';
import type { AppConfig, ModelPick, PanelToBg } from '../shared/types';
import { runTurn } from './agent';
import { detachAll } from './cdp';
import { pickDiagnoseTab, runDiagnostics } from './diagnose';
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
            if (s.usage.input + s.usage.output > 0) {
              port.postMessage({ type: 'usage', input: s.usage.input, output: s.usage.output });
            }
            break;
          }
          case 'send': {
            if (bound && !bound.running && msg.text.trim()) {
              void runTurn(bound, msg.text.trim());
            }
            break;
          }
          case 'abort':
            bound?.abort();
            break;
          case 'new_chat': {
            if (bound && !bound.running) {
              bound.reset();
              port.postMessage(bound.snapshot(modelPicks(bound.cfg)));
            }
            break;
          }
          case 'set_model': {
            if (bound && bound.cfg.models.find((m) => m.id === msg.modelId)) {
              bound.modelId = msg.modelId;
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
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  const s = sessions.get(windowId);
  if (s) {
    s.abort();
    sessions.delete(windowId);
    void chrome.storage.session.remove('session:' + windowId);
  }
});
