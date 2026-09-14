import type { AppConfig, ModelBinding, ModelConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  version: 2,
  providers: [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
    { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '' },
    { id: 'ollama', name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama' },
  ],
  models: [
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol（高性能）', vision: true, contextWindow: 400000 },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra（均衡）', vision: true, contextWindow: 400000 },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna（快速）', vision: true, contextWindow: 400000 },
    { id: 'deepseek-flash', label: 'DeepSeek Flash（原生视觉）', vision: true, contextWindow: 1000000 },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（无视觉）', vision: false, contextWindow: 1000000 },
    { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', vision: true, contextWindow: 200000 },
    { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', vision: true, contextWindow: 1000000 },
    { id: 'qwen3-vl', label: 'Qwen3-VL', vision: true, contextWindow: 128000 },
  ],
  bindings: [
    { id: 'openai/gpt-5.6-sol', modelId: 'gpt-5.6-sol', providerId: 'openai', apiModelName: 'gpt-5.6-sol', pricing: { input: 1.25, output: 10 }, enabled: true },
    { id: 'openai/gpt-5.6-terra', modelId: 'gpt-5.6-terra', providerId: 'openai', apiModelName: 'gpt-5.6-terra', pricing: { input: 0.6, output: 4 }, enabled: true },
    { id: 'openai/gpt-5.6-luna', modelId: 'gpt-5.6-luna', providerId: 'openai', apiModelName: 'gpt-5.6-luna', pricing: { input: 0.15, output: 1.2 }, enabled: true },
    { id: 'deepseek/deepseek-flash', modelId: 'deepseek-flash', providerId: 'deepseek', apiModelName: 'deepseek-flash', pricing: { input: 0.3, output: 1.2 }, enabled: true },
    { id: 'deepseek/deepseek-v4-pro', modelId: 'deepseek-v4-pro', providerId: 'deepseek', apiModelName: 'deepseek-v4-pro', pricing: { input: 1.32, output: 3.96 }, enabled: true },
    { id: 'openrouter/anthropic/claude-sonnet-4.6', modelId: 'anthropic/claude-sonnet-4.6', providerId: 'openrouter', apiModelName: 'anthropic/claude-sonnet-4.6', pricing: { input: 3, output: 15 }, enabled: true },
    { id: 'openrouter/google/gemini-3-flash-preview', modelId: 'google/gemini-3-flash-preview', providerId: 'openrouter', apiModelName: 'google/gemini-3-flash-preview', pricing: { input: 0.3, output: 2.5 }, enabled: true },
    { id: 'ollama/qwen3-vl', modelId: 'qwen3-vl', providerId: 'ollama', apiModelName: 'qwen3-vl', enabled: true },
  ],
  defaultBindingId: 'openai/gpt-5.6-terra',
  safety: {
    allowAllSites: false,
    confirmNewSite: true,
    confirmPassword: true,
    confirmJavascript: true,
    confirmUpload: true,
  },
  advanced: {
    maxIterations: 100,
    maxImagesKept: 4,
    maxContextTokens: 96000,
    screenshotMaxWidth: 1366,
    jpegQuality: 80,
    temperature: null,
    maxTokens: 4096,
    autoScreenshot: true,
    requestTimeoutMs: 180000,
    maxRetries: 2,
    setOfMarks: true,
    planning: true,
    enableJavascriptTool: false,
  },
  uiLang: 'auto',
  sites: {
    allowed: [],
    blocked: [
      'icbc.com.cn',
      'ccb.com',
      'boc.cn',
      'abchina.com',
      'alipay.com',
      'pay.weixin.qq.com',
      'paypal.com',
      'binance.com',
      'coinbase.com',
    ],
  },
};

interface LegacyModelConfig {
  id: string;
  providerId: string;
  model: string;
  label: string;
  vision: boolean;
  contextWindow?: number;
  pricing?: ModelBinding['pricing'];
}

function migrateLegacyModels(legacyModels: LegacyModelConfig[]): {
  models: ModelConfig[];
  bindings: ModelBinding[];
} {
  const modelMap = new Map<string, ModelConfig>();
  const bindings: ModelBinding[] = [];
  for (const legacy of legacyModels) {
    const key = legacy.model.toLowerCase();
    const existing = modelMap.get(key);
    const modelId = existing?.id ?? legacy.model;
    if (existing) {
      existing.vision ||= legacy.vision;
      if ((legacy.contextWindow ?? 0) > (existing.contextWindow ?? 0)) {
        existing.contextWindow = legacy.contextWindow;
      }
    } else {
      modelMap.set(key, {
        id: modelId,
        label: legacy.label,
        vision: !!legacy.vision,
        contextWindow: legacy.contextWindow,
      });
    }
    bindings.push({
      id: legacy.id,
      modelId,
      providerId: legacy.providerId,
      apiModelName: legacy.model,
      pricing: legacy.pricing,
      enabled: true,
    });
  }
  return { models: [...modelMap.values()], bindings };
}

/** 与默认值合并并迁移 v1 配置，容忍旧版本 / 缺字段的存储数据 */
export function mergeConfig(raw: unknown): AppConfig {
  const r = (raw ?? {}) as Partial<AppConfig> & {
    version?: number;
    defaultModelId?: string;
    models?: Array<ModelConfig | LegacyModelConfig>;
    bindings?: ModelBinding[];
  };
  const hasBindings = Array.isArray(r.bindings) && r.bindings.length > 0;
  const legacyModels =
    !hasBindings && Array.isArray(r.models)
      ? r.models.filter((m): m is LegacyModelConfig => 'providerId' in m && 'model' in m)
      : [];
  const migrated = legacyModels.length ? migrateLegacyModels(legacyModels) : null;
  const models =
    migrated?.models ??
    (Array.isArray(r.models) && r.models.length ? (r.models as ModelConfig[]) : DEFAULT_CONFIG.models);
  const bindings = (migrated?.bindings ?? (hasBindings ? r.bindings! : DEFAULT_CONFIG.bindings))
    .map((b) => ({ ...b, enabled: b.enabled !== false }));
  const requestedDefault = r.defaultBindingId || r.defaultModelId || DEFAULT_CONFIG.defaultBindingId;
  const defaultBindingId = bindings.some((b) => b.id === requestedDefault && b.enabled !== false)
    ? requestedDefault
    : bindings.find((b) => b.enabled !== false)?.id ?? bindings[0]?.id ?? DEFAULT_CONFIG.defaultBindingId;
  return {
    version: 2,
    providers: Array.isArray(r.providers) && r.providers.length ? r.providers : DEFAULT_CONFIG.providers,
    models,
    bindings,
    defaultBindingId,
    safety: { ...DEFAULT_CONFIG.safety, ...(r.safety ?? {}) },
    advanced: { ...DEFAULT_CONFIG.advanced, ...(r.advanced ?? {}) },
    uiLang: r.uiLang === 'zh' || r.uiLang === 'en' ? r.uiLang : 'auto',
    sites: {
      allowed: r.sites?.allowed ?? DEFAULT_CONFIG.sites.allowed,
      blocked: r.sites?.blocked ?? DEFAULT_CONFIG.sites.blocked,
    },
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const { config } = await chrome.storage.local.get('config');
  return mergeConfig(config);
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await chrome.storage.local.set({ config: cfg });
}

export function onConfigChange(cb: (cfg: AppConfig) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.config) cb(mergeConfig(changes.config.newValue));
  });
}
