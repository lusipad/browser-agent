// 会话：每个浏览器窗口一个，持有对话历史 / 时间线 / 授权状态 / 运行控制
// 持久化到 chrome.storage.session（Service Worker 被回收后可恢复）
import type {
  AppConfig,
  ApprovalDecision,
  BgToPanel,
  ChatMessage,
  ModelPick,
  TimelineItem,
} from '../shared/types';
import { uid } from '../shared/util';
import type { GifFrame } from './gif';
import type { ApprovalHost } from './permissions';

const MAX_GIF_FRAMES = 30;

export class Session implements ApprovalHost {
  readonly windowId: number;
  cfg: AppConfig;
  modelId: string;
  messages: ChatMessage[] = [];
  timeline: TimelineItem[] = [];
  running = false;
  aborted = false;
  controller: AbortController | null = null;
  currentTabId: number | null = null;
  tempAllowedHosts = new Set<string>();
  gifFrames: GifFrame[] = [];
  usage = { input: 0, output: 0 };
  port: chrome.runtime.Port | null = null;
  private pendingApprovals = new Map<string, (d: ApprovalDecision) => void>();

  constructor(windowId: number, cfg: AppConfig) {
    this.windowId = windowId;
    this.cfg = cfg;
    this.modelId = cfg.defaultModelId;
  }

  modelVision(): boolean {
    return this.cfg.models.find((m) => m.id === this.modelId)?.vision ?? true;
  }

  emit(ev: BgToPanel): void {
    try {
      this.port?.postMessage(ev);
    } catch {
      /* 面板已关闭 */
    }
  }

  upsert(item: TimelineItem): void {
    const i = this.timeline.findIndex((x) => x.id === item.id);
    if (i >= 0) this.timeline[i] = item;
    else this.timeline.push(item);
    this.emit({ type: 'item_upsert', item });
  }

  info(text: string): void {
    this.upsert({ kind: 'info', id: uid('i'), text });
  }

  error(text: string): void {
    this.upsert({ kind: 'error', id: uid('e'), text });
  }

  requestApproval(req: { title: string; description: string; siteOption?: boolean }): Promise<ApprovalDecision> {
    const id = uid('appr');
    const item: TimelineItem = {
      kind: 'approval',
      id,
      title: req.title,
      description: req.description,
      siteOption: req.siteOption,
    };
    this.upsert(item);
    return new Promise((resolve) => {
      this.pendingApprovals.set(id, (d) => {
        this.upsert({ ...item, decision: d });
        resolve(d);
      });
    });
  }

  resolveApproval(id: string, decision: ApprovalDecision): void {
    const r = this.pendingApprovals.get(id);
    if (r) {
      this.pendingApprovals.delete(id);
      r(decision);
    }
  }

  abort(): void {
    this.aborted = true;
    this.controller?.abort();
    for (const [id, r] of [...this.pendingApprovals]) {
      this.pendingApprovals.delete(id);
      r('deny');
    }
  }

  recordFrame(f: GifFrame): void {
    this.gifFrames.push(f);
    if (this.gifFrames.length > MAX_GIF_FRAMES) {
      this.gifFrames.splice(0, this.gifFrames.length - MAX_GIF_FRAMES);
    }
  }

  snapshot(models: ModelPick[]): BgToPanel {
    return {
      type: 'snapshot',
      items: this.timeline,
      running: this.running,
      modelId: this.modelId,
      models,
    };
  }

  reset(): void {
    this.messages = [];
    this.timeline = [];
    this.gifFrames = [];
    this.tempAllowedHosts.clear();
    this.usage = { input: 0, output: 0 };
    this.currentTabId = null;
    this.aborted = false;
    void this.persist();
  }

  private storageKey(): string {
    return 'session:' + this.windowId;
  }

  async persist(): Promise<void> {
    const data = {
      messages: this.messages,
      timeline: this.timeline,
      modelId: this.modelId,
      currentTabId: this.currentTabId,
      usage: this.usage,
      tempAllowedHosts: [...this.tempAllowedHosts],
    };
    try {
      await chrome.storage.session.set({ [this.storageKey()]: data });
    } catch {
      // 配额不足：丢弃图片后重试一次
      try {
        const slim = structuredClone(data);
        for (const m of slim.messages) {
          m.content = m.content.map((b) => {
            if (b.type === 'image') return { type: 'text' as const, text: '[screenshot dropped from storage]' };
            if (b.type === 'tool_result') {
              b.content = b.content.map((c) =>
                c.type === 'image' ? { type: 'text' as const, text: '[screenshot dropped from storage]' } : c,
              );
            }
            return b;
          });
        }
        for (const it of slim.timeline) {
          if (it.kind === 'tool' && it.images) it.images = it.images.map(() => null);
        }
        await chrome.storage.session.set({ [this.storageKey()]: slim });
      } catch {
        /* 放弃持久化 */
      }
    }
  }

  static async restore(windowId: number, cfg: AppConfig): Promise<Session> {
    const s = new Session(windowId, cfg);
    try {
      const key = 'session:' + windowId;
      const data = (await chrome.storage.session.get(key))[key] as any;
      if (data) {
        s.messages = data.messages ?? [];
        s.timeline = data.timeline ?? [];
        s.modelId = data.modelId ?? cfg.defaultModelId;
        s.currentTabId = data.currentTabId ?? null;
        s.usage = data.usage ?? { input: 0, output: 0 };
        s.tempAllowedHosts = new Set(data.tempAllowedHosts ?? []);
      }
    } catch {
      /* 无存档或解析失败 */
    }
    if (!cfg.models.find((m) => m.id === s.modelId)) s.modelId = cfg.defaultModelId;
    return s;
  }
}
