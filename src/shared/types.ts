// ============================================================
// 内部统一消息格式（Anthropic 风格 content blocks）
// 各供应商适配器负责与 OpenAI / Gemini 格式互转
// ============================================================

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  mediaType: string; // e.g. 'image/jpeg'
  data: string; // base64（不含 data: 前缀）
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  toolName: string;
  content: Array<TextBlock | ImageBlock>;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/** 工具执行结果 */
export interface ToolOutput {
  content: Array<TextBlock | ImageBlock>;
  isError?: boolean;
}

// ============================================================
// 供应商 / 模型配置（全部为 OpenAI 兼容 endpoint）
// ============================================================

export interface ProviderConfig {
  id: string;
  name: string;
  /** OpenAI 兼容 API 根路径，需包含 /v1（如 https://api.openai.com/v1、http://localhost:11434/v1） */
  baseUrl: string;
  apiKey: string;
}

export interface ModelConfig {
  /** `${providerId}/${model}` */
  id: string;
  providerId: string;
  /** 传给 API 的模型名 */
  model: string;
  label: string;
  /** 是否支持图像输入；false 时自动省略截图，改用 read_page */
  vision: boolean;
}

export interface SafetySettings {
  /** 无需逐站授权（不推荐） */
  allowAllSites: boolean;
  confirmNewSite: boolean;
  confirmPassword: boolean;
  confirmJavascript: boolean;
  confirmUpload: boolean;
}

export interface AdvancedSettings {
  maxIterations: number;
  /** 对话历史中保留的最近截图数量，更早的会被清理以节省 token */
  maxImagesKept: number;
  screenshotMaxWidth: number;
  jpegQuality: number;
  temperature: number | null;
  maxTokens: number;
  /** 每次操作后自动附带一张新截图 */
  autoScreenshot: boolean;
  requestTimeoutMs: number;
}

export interface SitePermissions {
  allowed: string[];
  blocked: string[];
}

export interface AppConfig {
  version: 1;
  providers: ProviderConfig[];
  models: ModelConfig[];
  defaultModelId: string;
  safety: SafetySettings;
  advanced: AdvancedSettings;
  sites: SitePermissions;
}

// ============================================================
// 面板时间线（UI 渲染项）
// ============================================================

export type ApprovalDecision = 'allow_once' | 'allow_site' | 'deny';

export type TimelineItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; done: boolean }
  | {
      kind: 'tool';
      id: string;
      name: string;
      summary: string;
      status: 'running' | 'ok' | 'error';
      detail?: string;
      /** data URL 列表；被清理的截图为 null */
      images?: Array<string | null>;
    }
  | {
      kind: 'approval';
      id: string;
      title: string;
      description: string;
      /** 是否提供“始终允许此站点”选项 */
      siteOption?: boolean;
      decision?: ApprovalDecision;
    }
  | { kind: 'error'; id: string; text: string }
  | { kind: 'info'; id: string; text: string };

export interface ModelPick {
  id: string;
  label: string;
  vision: boolean;
  providerName: string;
}

// ============================================================
// 面板 <-> 后台 消息协议
// ============================================================

export type PanelToBg =
  | { type: 'hello'; windowId: number }
  | { type: 'send'; text: string }
  | { type: 'abort' }
  | { type: 'new_chat' }
  | { type: 'set_model'; modelId: string }
  | { type: 'approval'; id: string; decision: ApprovalDecision }
  | { type: 'detach' }
  | { type: 'open_options' };

export type BgToPanel =
  | {
      type: 'snapshot';
      items: TimelineItem[];
      running: boolean;
      modelId: string;
      models: ModelPick[];
    }
  | { type: 'item_upsert'; item: TimelineItem }
  | { type: 'text_delta'; id: string; delta: string }
  | { type: 'run_state'; running: boolean }
  | { type: 'models'; models: ModelPick[]; modelId: string }
  | { type: 'usage'; input: number; output: number };
