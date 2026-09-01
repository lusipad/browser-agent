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
import { resolveLang, translate, type MsgKey } from '../shared/i18n';
import { deriveTitle, uid } from '../shared/util';
import type { GifFrame } from './gif';
import type { ArchivedConv } from './history';
import type { ApprovalHost } from './permissions';

const MAX_GIF_FRAMES = 30;

export class Session implements ApprovalHost {
  readonly windowId: number;
  cfg: AppConfig;
  modelId: string;
  conversationId: string = uid('conv');
  messages: ChatMessage[] = [];
  timeline: TimelineItem[] = [];
  running = false;
  aborted = false;
  controller: AbortController | null = null;
  currentTabId: number | null = null;
  tempAllowedHosts = new Set<string>();
  /** 已归入 Agent 标签组的标签（避免重复分组；不持久化） */
  groupedTabs = new Set<number>();
  gifFrames: GifFrame[] = [];
  usage = { input: 0, output: 0 };
  /** 会话级视觉覆盖：null=跟随模型，false=本会话关闭视觉，true=本会话强制开启 */
  visionOverride: boolean | null = null;
  port: chrome.runtime.Port | null = null;
  private pendingApprovals = new Map<string, (d: ApprovalDecision) => void>();

  constructor(windowId: number, cfg: AppConfig) {
    this.windowId = windowId;
    this.cfg = cfg;
    this.modelId = cfg.defaultModelId;
  }

  /** 本会话生效的视觉策略 = 会话覆盖 ?? 模型能力 */
  effectiveVision(): boolean {
    return this.visionOverride ?? this.cfg.models.find((m) => m.id === this.modelId)?.vision ?? true;
  }

  /** 按当前界面语言翻译（面向用户的后台文案） */
  t(key: MsgKey, params?: Array<string | number>): string {
    return translate(resolveLang(this.cfg.uiLang), key, params);
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
      visionOverride: this.visionOverride,
    };
  }

  title(): string {
    return deriveTitle(this.messages);
  }

  /** 打包为可归档的会话快照 */
  toArchived(): ArchivedConv {
    return {
      id: this.conversationId,
      title: this.title(),
      updatedAt: Date.now(),
      msgCount: this.messages.length,
      messages: this.messages,
      timeline: this.timeline,
      modelId: this.modelId,
      usage: this.usage,
      visionOverride: this.visionOverride,
    };
  }

  /** 从归档会话恢复为当前会话（切换历史时用） */
  loadFrom(conv: ArchivedConv): void {
    this.conversationId = conv.id;
    this.messages = conv.messages ?? [];
    this.timeline = conv.timeline ?? [];
    this.usage = conv.usage ?? { input: 0, output: 0 };
    if (this.cfg.models.find((m) => m.id === conv.modelId)) this.modelId = conv.modelId;
    this.visionOverride = conv.visionOverride ?? null;
    this.gifFrames = [];
    this.tempAllowedHosts.clear();
    this.groupedTabs.clear();
    this.currentTabId = null;
    this.aborted = false;
    void this.persist();
  }

  reset(): void {
    this.conversationId = uid('conv');
    this.messages = [];
    this.timeline = [];
    this.gifFrames = [];
    this.tempAllowedHosts.clear();
    this.groupedTabs.clear();
    this.usage = { input: 0, output: 0 };
    this.visionOverride = null;
    this.currentTabId = null;
    this.aborted = false;
    void this.persist();
  }

  private storageKey(): string {
    return 'session:' + this.windowId;
  }

  async persist(): Promise<void> {
    const data = {
      conversationId: this.conversationId,
      messages: this.messages,
      timeline: this.timeline,
      modelId: this.modelId,
      visionOverride: this.visionOverride,
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
        s.conversationId = data.conversationId ?? s.conversationId;
        s.messages = data.messages ?? [];
        s.timeline = data.timeline ?? [];
        s.modelId = data.modelId ?? cfg.defaultModelId;
        s.visionOverride = typeof data.visionOverride === 'boolean' ? data.visionOverride : null;
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
