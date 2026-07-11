import type { AppConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  providers: [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
    { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '' },
    { id: 'ollama', name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama' },
  ],
  models: [
    { id: 'openai/gpt-5.6', providerId: 'openai', model: 'gpt-5.6', label: 'GPT-5.6', vision: true },
    { id: 'openai/gpt-5.6-terra', providerId: 'openai', model: 'gpt-5.6-terra', label: 'GPT-5.6 Terra（均衡）', vision: true },
    { id: 'openai/gpt-5.6-luna', providerId: 'openai', model: 'gpt-5.6-luna', label: 'GPT-5.6 Luna（快速）', vision: true },
    { id: 'deepseek/deepseek-v4-flash', providerId: 'deepseek', model: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash（无视觉）', vision: false },
    { id: 'deepseek/deepseek-v4-pro', providerId: 'deepseek', model: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（无视觉）', vision: false },
    { id: 'openrouter/anthropic/claude-sonnet-4.6', providerId: 'openrouter', model: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (OpenRouter)', vision: true },
    { id: 'openrouter/google/gemini-3-flash-preview', providerId: 'openrouter', model: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (OpenRouter)', vision: true },
    { id: 'ollama/qwen3-vl', providerId: 'ollama', model: 'qwen3-vl', label: 'Qwen3-VL（本地）', vision: true },
  ],
  defaultModelId: 'openai/gpt-5.6',
  safety: {
    allowAllSites: false,
    confirmNewSite: true,
    confirmPassword: true,
    confirmJavascript: true,
    confirmUpload: true,
  },
  advanced: {
    maxIterations: 24,
    maxImagesKept: 4,
    screenshotMaxWidth: 1366,
    jpegQuality: 80,
    temperature: null,
    maxTokens: 4096,
    autoScreenshot: true,
    requestTimeoutMs: 180000,
    setOfMarks: true,
    planning: true,
  },
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

/** 与默认值做浅层合并，容忍旧版本 / 缺字段的存储数据 */
export function mergeConfig(raw: unknown): AppConfig {
  const r = (raw ?? {}) as Partial<AppConfig>;
  return {
    version: 1,
    providers: Array.isArray(r.providers) && r.providers.length ? r.providers : DEFAULT_CONFIG.providers,
    models: Array.isArray(r.models) && r.models.length ? r.models : DEFAULT_CONFIG.models,
    defaultModelId: r.defaultModelId || DEFAULT_CONFIG.defaultModelId,
    safety: { ...DEFAULT_CONFIG.safety, ...(r.safety ?? {}) },
    advanced: { ...DEFAULT_CONFIG.advanced, ...(r.advanced ?? {}) },
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
