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
  reasoning_content?: string;
}

/** 工具执行结果 */
export interface ToolOutput {
  content: Array<TextBlock | ImageBlock>;
  isError?: boolean;
}

// ============================================================
// 供应商、模型与接入绑定（全部为 OpenAI 兼容 endpoint）
// ============================================================

export interface ProviderConfig {
  id: string;
  name: string;
  /** OpenAI 兼容 API 根路径，需包含 /v1（如 https://api.openai.com/v1、http://localhost:11434/v1） */
  baseUrl: string;
  apiKey: string;
}

export interface ModelPricing {
  /** 每 100 万输入 token 的美元价 */
  input: number;
  /** 每 100 万输出 token 的美元价 */
  output: number;
}

/** 模型本体：描述模型自身的能力，不包含厂商、密钥或价格。 */
export interface ModelConfig {
  id: string;
  label: string;
  /** 是否支持图像输入；false 时自动省略截图，改用 read_page */
  vision: boolean;
  /** 上下文窗口大小（token）；用于计算输入预算，缺省则回落到 advanced.maxContextTokens */
  contextWindow?: number;
}

/** 模型在某个厂商/端点上的接入配置。 */
export interface ModelBinding {
  /** 稳定的接入配置 ID；编辑厂商或 API 模型名时不应改变 */
  id: string;
  modelId: string;
  providerId: string;
  /** 传给 API 的模型名 */
  apiModelName: string;
  /** 计费（美元 / 100 万 token）；填写后侧边栏显示累计成本 */
  pricing?: ModelPricing;
  /** 是否允许在侧边栏选择并用于运行；旧配置缺失时按启用处理 */
  enabled?: boolean;
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
  /** 输入 token 兜底预算：模型未填 contextWindow 时，历史超过此值即从最旧开始裁剪 */
  maxContextTokens: number;
  screenshotMaxWidth: number;
  jpegQuality: number;
  temperature: number | null;
  maxTokens: number;
  /** 每次操作后自动附带一张新截图 */
  autoScreenshot: boolean;
  requestTimeoutMs: number;
  /** 连接阶段（5xx/429/网络错误）的最大退避重试次数 */
  maxRetries: number;
  /** 在截图上叠加可交互元素的编号框（set-of-marks），大幅提升视觉点击准确率 */
  setOfMarks: boolean;
  /** 任务开始先规划、完成时自检是否达成（Planner + Validator） */
  planning: boolean;
  /** 是否启用 javascript_tool（在页面执行任意 JS）；出于安全默认关闭 */
  enableJavascriptTool: boolean;
}

export interface SitePermissions {
  allowed: string[];
  blocked: string[];
}

export interface AppConfig {
  version: 2;
  providers: ProviderConfig[];
  models: ModelConfig[];
  bindings: ModelBinding[];
  defaultBindingId: string;
  safety: SafetySettings;
  advanced: AdvancedSettings;
  sites: SitePermissions;
  /** 界面语言：'auto' 跟随浏览器，或强制 'zh' / 'en' */
  uiLang: 'auto' | 'zh' | 'en';
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
  | { kind: 'info'; id: string; text: string; action?: 'continue' };

export interface BindingPick {
  id: string;
  label: string;
  vision: boolean;
  providerName: string;
  enabled?: boolean;
}

export interface DiscoveredModel {
  id: string;
  ownedBy?: string;
  object?: string;
}

/** 会话列表项（轻量元数据，不含消息体） */
export interface ConvMeta {
  id: string;
  title: string;
  updatedAt: number;
  msgCount: number;
}

// ============================================================
// 诊断（在真实标签页上一键体检感知层 + CDP 全链路）
// ============================================================

export interface DiagCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export interface DiagnosticsReport {
  ok: boolean;
  tab: { id: number; url: string; title: string } | null;
  checks: DiagCheck[];
}

// ============================================================
// 面板 <-> 后台 消息协议
// ============================================================

export type PanelToBg =
  | { type: 'hello'; windowId: number }
  | { type: 'send'; text: string }
  | { type: 'continue' }
  | { type: 'abort' }
  | { type: 'new_chat' }
  | { type: 'switch_conv'; id: string }
  | { type: 'delete_conv'; id: string }
  | { type: 'set_binding'; bindingId: string }
  | { type: 'set_vision'; enabled: boolean }
  | { type: 'approval'; id: string; decision: ApprovalDecision }
  | { type: 'detach' }
  | { type: 'open_options' };

export type BgToPanel =
  | {
      type: 'snapshot';
      items: TimelineItem[];
      running: boolean;
      bindingId: string;
      bindings: BindingPick[];
      /** 会话级视觉覆盖：null=跟随模型，false=本会话关闭，true=本会话强制开启 */
      visionOverride: boolean | null;
    }
  | { type: 'item_upsert'; item: TimelineItem }
  | { type: 'text_delta'; id: string; delta: string }
  | { type: 'run_state'; running: boolean }
  | { type: 'conversations'; list: ConvMeta[]; activeId: string }
  | { type: 'bindings'; bindings: BindingPick[]; bindingId: string }
  | {
      type: 'usage';
      input: number;
      output: number;
      /** 累计成本（美元）；当前模型未配置计费时为 null */
      cost: number | null;
      /** 上次请求发送前估算的输入 token 占用（治理后） */
      contextTokens?: number;
      /** 当前输入 token 预算 */
      contextBudget?: number;
    };
