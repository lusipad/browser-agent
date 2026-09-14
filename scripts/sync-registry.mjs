#!/usr/bin/env node
// Generates registry/models.json from LiteLLM's open-source model database.
// Usage: node scripts/sync-registry.mjs
//
// Providers / models not covered by LiteLLM are kept in MANUAL_PROVIDERS
// and MANUAL_MODELS below — edit those when adding a niche provider by hand.

import { writeFileSync, readFileSync } from 'node:fs';

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// ── Provider mapping: litellm_provider → our registry provider ──────────
const PROVIDERS = {
  openai:      { id: 'openai',     name: 'OpenAI',                   baseUrl: 'https://api.openai.com/v1' },
  anthropic:   { id: 'anthropic',  name: 'Anthropic (Claude)',       baseUrl: 'https://api.anthropic.com/v1' },
  deepseek:    { id: 'deepseek',   name: 'DeepSeek',                 baseUrl: 'https://api.deepseek.com/v1' },
  xai:         { id: 'xai',        name: 'xAI (Grok)',               baseUrl: 'https://api.x.ai/v1' },
  mistral:     { id: 'mistral',    name: 'Mistral AI',               baseUrl: 'https://api.mistral.ai/v1' },
  gemini:      { id: 'google',     name: 'Google AI Studio',         baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  groq:        { id: 'groq',       name: 'Groq（快速推理）',         baseUrl: 'https://api.groq.com/openai/v1' },
  openrouter:  { id: 'openrouter', name: 'OpenRouter',               baseUrl: 'https://openrouter.ai/api/v1' },
  dashscope:   { id: 'dashscope',  name: '阿里云百炼（通义千问）',   baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  moonshot:    { id: 'moonshot',   name: '月之暗面 Kimi',            baseUrl: 'https://api.moonshot.cn/v1' },
  minimax:     { id: 'minimax',    name: 'MiniMax',                  baseUrl: 'https://api.minimax.chat/v1' },
  together_ai: { id: 'together',   name: 'Together AI',              baseUrl: 'https://api.together.xyz/v1' },
  fireworks_ai:{ id: 'fireworks',  name: 'Fireworks AI',             baseUrl: 'https://api.fireworks.ai/inference/v1' },
  cerebras:    { id: 'cerebras',   name: 'Cerebras（超快推理）',     baseUrl: 'https://api.cerebras.ai/v1' },
  sambanova:   { id: 'sambanova',  name: 'SambaNova（快速推理）',    baseUrl: 'https://api.sambanova.ai/v1' },
  volcengine:  { id: 'volcengine', name: '火山引擎（豆包）',        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
};

// ── Curated model list: litellm_key → label ────────────��────────────────
// Only these models are included. Label value is used as-is; null = auto.
const CURATED = {
  openai: {
    'gpt-5.6-sol':     'GPT-5.6 Sol（高性能）',
    'gpt-5.6-terra':   'GPT-5.6 Terra（均衡）',
    'gpt-5.6-luna':    'GPT-5.6 Luna（快速）',
    'o3':              'o3（深度推理）',
    'o4-mini':         'o4-mini（快速推理）',
    'gpt-4.1':         'GPT-4.1',
    'gpt-4.1-mini':    'GPT-4.1 Mini（轻量）',
    'gpt-4.1-nano':    'GPT-4.1 Nano（超轻量）',
    'gpt-4o':          'GPT-4o',
    'gpt-4o-mini':     'GPT-4o Mini',
  },
  anthropic: {
    'claude-opus-5':            'Claude Opus 5',
    'claude-sonnet-5':          'Claude Sonnet 5',
    'claude-opus-4-8':          'Claude Opus 4.8',
    'claude-opus-4-7':          'Claude Opus 4.7',
    'claude-opus-4-6':          'Claude Opus 4.6',
    'claude-opus-4-5':          'Claude Opus 4.5',
    'claude-sonnet-4-6':        'Claude Sonnet 4.6',
    'claude-sonnet-4-5':        'Claude Sonnet 4.5',
    'claude-haiku-4-5':         'Claude Haiku 4.5（快速）',
    'claude-fable-5':           'Claude Fable 5',
  },
  deepseek: {
    'deepseek-flash':       'DeepSeek Flash（原生视觉）',
    'deepseek-v4-pro':      'DeepSeek V4 Pro',
  },
  xai: {
    'xai/grok-4.6':                'Grok 4.6',
    'xai/grok-4.5':                'Grok 4.5',
    'xai/grok-4':                  'Grok 4',
    'xai/grok-4-fast-reasoning':   'Grok 4 Fast（推理）',
    'xai/grok-3':                  'Grok 3',
    'xai/grok-3-mini':             'Grok 3 Mini',
    'xai/grok-code-fast':          'Grok Code（编程）',
  },
  mistral: {
    'mistral/mistral-large-latest':  'Mistral Large',
    'mistral/mistral-medium-latest': 'Mistral Medium',
    'mistral/mistral-small-latest':  'Mistral Small',
    'mistral/codestral-latest':      'Codestral（编程）',
    'mistral/pixtral-large-latest':  'Pixtral Large（视觉）',
  },
  gemini: {
    'gemini/gemini-2.5-pro':       'Gemini 2.5 Pro',
    'gemini/gemini-2.5-flash':     'Gemini 2.5 Flash（快速）',
    'gemini/gemini-2.5-flash-lite':'Gemini 2.5 Flash Lite（超轻量）',
    'gemini/gemini-2.0-flash':     'Gemini 2.0 Flash',
  },
  groq: {
    'groq/llama-3.3-70b-versatile':                    'Llama 3.3 70B (Groq·超快)',
    'groq/meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick (Groq)',
    'groq/meta-llama/llama-4-scout-17b-16e-instruct':    'Llama 4 Scout (Groq)',
    'groq/qwen/qwen3-32b':                             'Qwen3 32B (Groq)',
  },
  openrouter: {
    'openrouter/anthropic/claude-sonnet-4.6':          'Claude Sonnet 4.6 (OR)',
    'openrouter/anthropic/claude-opus-4':              'Claude Opus 4 (OR)',
    'openrouter/anthropic/claude-haiku-4.5':           'Claude Haiku 4.5 (OR)',
    'openrouter/google/gemini-2.5-pro':                'Gemini 2.5 Pro (OR)',
    'openrouter/google/gemini-2.5-flash':              'Gemini 2.5 Flash (OR)',
    'openrouter/deepseek/deepseek-chat':               'DeepSeek V3 (OR)',
    'openrouter/qwen/qwen3-235b-a22b-2507':           'Qwen3 235B (OR)',
    'openrouter/mistralai/mistral-large':              'Mistral Large (OR)',
  },
  dashscope: {
    'dashscope/qwen-max':       '通义千问 Max（旗舰）',
    'dashscope/qwen-plus':      '通义千问 Plus（均衡）',
    'dashscope/qwen-flash':     '通义千问 Flash（极速低价）',
    'dashscope/qwen-coder':     '通义千问 Coder（编程）',
    'dashscope/qwen3-vl-plus':  '通义千问 VL-Plus（视觉）',
  },
  moonshot: {
    'moonshot/kimi-k3':               'Kimi K3（最新旗舰）',
    'moonshot/kimi-k2.7-code':        'Kimi K2.7 Code（编程）',
    'moonshot/kimi-k2.6':             'Kimi K2.6',
    'moonshot/kimi-k2.5':             'Kimi K2.5',
    'moonshot/kimi-k2-thinking':      'Kimi K2 Thinking（推理）',
    'moonshot/moonshot-v1-128k':      'Moonshot V1 128K（经典）',
  },
  minimax: {
    'minimax/MiniMax-M3':             'MiniMax M3（最新）',
    'minimax/MiniMax-M2.5':           'MiniMax M2.5',
    'minimax/MiniMax-M2.5-lightning': 'MiniMax M2.5 Lightning（快速）',
    'minimax/MiniMax-M2.1':           'MiniMax M2.1',
  },
  together_ai: {
    'together_ai/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': 'Llama 4 Maverick (Together)',
    'together_ai/meta-llama/Llama-4-Scout-17B-16E-Instruct':         'Llama 4 Scout (Together)',
    'together_ai/deepseek-ai/DeepSeek-R1':                            'DeepSeek R1 (Together)',
    'together_ai/deepseek-ai/DeepSeek-V3':                            'DeepSeek V3 (Together)',
    'together_ai/Qwen/Qwen3-235B-A22B-Thinking-2507':                'Qwen3 235B Thinking (Together)',
    'together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo':           'Llama 3.3 70B (Together)',
  },
  fireworks_ai: {
    'fireworks_ai/accounts/fireworks/models/deepseek-v4-flash':  'DeepSeek V4 Flash (Fireworks)',
    'fireworks_ai/accounts/fireworks/models/deepseek-v4-pro':    'DeepSeek V4 Pro (Fireworks)',
    'fireworks_ai/accounts/fireworks/models/deepseek-r1':        'DeepSeek R1 (Fireworks)',
    'fireworks_ai/accounts/fireworks/models/llama4-maverick-instruct-basic': 'Llama 4 Maverick (Fireworks)',
    'fireworks_ai/accounts/fireworks/models/qwen3-235b-a22b':   'Qwen3 235B (Fireworks)',
  },
  cerebras: {
    'cerebras/llama-3.3-70b': 'Llama 3.3 70B (Cerebras·超快)',
    'cerebras/qwen-3-32b':    'Qwen3 32B (Cerebras·超快)',
  },
  sambanova: {
    'sambanova/DeepSeek-R1':                    'DeepSeek R1 (SambaNova)',
    'sambanova/Meta-Llama-3.3-70B-Instruct':    'Llama 3.3 70B (SambaNova)',
    'sambanova/Qwen3-32B':                      'Qwen3 32B (SambaNova)',
  },
  volcengine: {
    'volcengine/doubao-seed-2-0-pro-260215':  '豆包 Seed 2.0 Pro（火山）',
    'volcengine/doubao-seed-2-0-lite-260215': '豆包 Seed 2.0 Lite（火山）',
  },
};

// ── Providers not in LiteLLM — maintained manually ──────────────────────
const MANUAL_PROVIDERS = [
  { id: 'siliconflow', name: '硅基流动 SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'zhipu',       name: '智谱 AI',              baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'stepfun',     name: '阶跃星辰',             baseUrl: 'https://api.stepfun.com/v1' },
  { id: 'baichuan',    name: '百川智能',              baseUrl: 'https://api.baichuan-ai.com/v1' },
  { id: 'spark',       name: '讯飞星火',             baseUrl: 'https://spark-api-open.xf-yun.com/v1' },
  { id: 'ollama',      name: 'Ollama 本地',           baseUrl: 'http://localhost:11434/v1' },
];

const MANUAL_MODELS = [
  { id: 'siliconflow/deepseek-ai/DeepSeek-V3',             providerId: 'siliconflow', model: 'deepseek-ai/DeepSeek-V3',             label: 'DeepSeek V3（硅基流动）',            vision: false, contextWindow: 64000,  pricing: { input: 0.18, output: 0.37 } },
  { id: 'siliconflow/deepseek-ai/DeepSeek-R1',             providerId: 'siliconflow', model: 'deepseek-ai/DeepSeek-R1',             label: 'DeepSeek R1（硅基流动·推理）',        vision: false, contextWindow: 64000,  pricing: { input: 0.30, output: 1.50 } },
  { id: 'siliconflow/Qwen/Qwen2.5-VL-72B-Instruct',       providerId: 'siliconflow', model: 'Qwen/Qwen2.5-VL-72B-Instruct',       label: 'Qwen2.5-VL 72B（硅基流动·视觉）',    vision: true,  contextWindow: 32000,  pricing: { input: 0.56, output: 0.56 } },
  { id: 'siliconflow/THUDM/GLM-4-Plus',                    providerId: 'siliconflow', model: 'THUDM/GLM-4-Plus',                    label: 'GLM-4 Plus（硅基流动）',              vision: false, contextWindow: 128000, pricing: { input: 0.69, output: 0.69 } },
  { id: 'siliconflow/Qwen/Qwen3-30B-A3B',                  providerId: 'siliconflow', model: 'Qwen/Qwen3-30B-A3B',                  label: 'Qwen3 30B MoE（硅基流动·轻快）',     vision: false, contextWindow: 32000,  pricing: { input: 0.07, output: 0.14 } },
  { id: 'siliconflow/internlm/internlm3-8b-instruct',      providerId: 'siliconflow', model: 'internlm/internlm3-8b-instruct',      label: 'InternLM3 8B（���基流动·免费）',       vision: false, contextWindow: 32000,  pricing: { input: 0, output: 0 } },

  { id: 'zhipu/glm-4-plus',  providerId: 'zhipu', model: 'glm-4-plus',  label: 'GLM-4 Plus（智谱旗舰）',             vision: false, contextWindow: 128000,  pricing: { input: 6.94, output: 6.94 } },
  { id: 'zhipu/glm-4-flash', providerId: 'zhipu', model: 'glm-4-flash', label: 'GLM-4 Flash（智谱·极速免费）',       vision: false, contextWindow: 128000,  pricing: { input: 0, output: 0 } },
  { id: 'zhipu/glm-4v-plus', providerId: 'zhipu', model: 'glm-4v-plus', label: 'GLM-4V Plus（智谱·视觉）',           vision: true,  contextWindow: 8000,    pricing: { input: 1.39, output: 1.39 } },
  { id: 'zhipu/glm-4-long',  providerId: 'zhipu', model: 'glm-4-long',  label: 'GLM-4 Long（智谱·百万上下文）',     vision: false, contextWindow: 1000000, pricing: { input: 1.39, output: 1.39 } },

  { id: 'stepfun/step-2-16k',  providerId: 'stepfun', model: 'step-2-16k',  label: 'Step-2（阶跃·旗舰）',           vision: false, contextWindow: 16000, pricing: { input: 5.28, output: 17.50 } },
  { id: 'stepfun/step-1v-32k', providerId: 'stepfun', model: 'step-1v-32k', label: 'Step-1V（阶跃·视觉）',          vision: true,  contextWindow: 32000, pricing: { input: 2.08, output: 6.25 } },
  { id: 'stepfun/step-1-flash', providerId: 'stepfun', model: 'step-1-flash', label: 'Step-1 Flash（阶跃·极速低价）', vision: false, contextWindow: 16000, pricing: { input: 0.14, output: 0.42 } },

  { id: 'baichuan/Baichuan4',       providerId: 'baichuan', model: 'Baichuan4',       label: '百川 4（旗舰）', vision: false, contextWindow: 128000, pricing: { input: 1.39, output: 1.39 } },
  { id: 'baichuan/Baichuan3-Turbo', providerId: 'baichuan', model: 'Baichuan3-Turbo', label: '百川 3 Turbo（快速）', vision: false, contextWindow: 32000, pricing: { input: 0.42, output: 0.42 } },

  { id: 'spark/generalv3.5', providerId: 'spark', model: 'generalv3.5', label: '星火 3.5（讯飞）',          vision: false, contextWindow: 128000, pricing: { input: 0.42, output: 0.42 } },
  { id: 'spark/4.0Ultra',    providerId: 'spark', model: '4.0Ultra',    label: '星火 4.0 Ultra（讯飞·旗舰）', vision: false, contextWindow: 128000, pricing: { input: 6.94, output: 6.94 } },

  { id: 'ollama/qwen3-vl',       providerId: 'ollama', model: 'qwen3-vl',       label: 'Qwen3-VL（本地·视觉）',          vision: true,  contextWindow: 128000 },
  { id: 'ollama/llama3.3',       providerId: 'ollama', model: 'llama3.3',       label: 'Llama 3.3（本地）',                vision: false, contextWindow: 128000 },
  { id: 'ollama/qwen3',          providerId: 'ollama', model: 'qwen3',          label: 'Qwen3（本地）',                    vision: false, contextWindow: 128000 },
  { id: 'ollama/deepseek-r1:14b',providerId: 'ollama', model: 'deepseek-r1:14b',label: 'DeepSeek R1 14B（本地·推理）',    vision: false, contextWindow: 64000 },
  { id: 'ollama/gemma3',         providerId: 'ollama', model: 'gemma3',         label: 'Gemma 3（本地）',                  vision: false, contextWindow: 128000 },
  { id: 'ollama/glm4',           providerId: 'ollama', model: 'glm4',           label: 'GLM-4（本地）',                    vision: false, contextWindow: 128000 },
  { id: 'ollama/minicpm-v',      providerId: 'ollama', model: 'minicpm-v',      label: 'MiniCPM-V（本地·视觉·轻量）',    vision: true,  contextWindow: 8000 },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function stripPrefix(key, litellmProvider) {
  const prefixes = [
    `${litellmProvider}/`,
    'accounts/fireworks/models/',
  ];
  let model = key;
  for (const p of prefixes) {
    if (model.startsWith(p)) {
      model = model.slice(p.length);
      break;
    }
  }
  return model;
}

function toMillionTokens(perToken) {
  if (!perToken || perToken === 0) return 0;
  return Math.round(perToken * 1_000_000 * 100) / 100;
}

// ── Main ─────────────────────────────────────────────────────────────────

console.log('Fetching LiteLLM model database...');
const resp = await fetch(LITELLM_URL);
if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
const litellm = await resp.json();
console.log(`  ${Object.keys(litellm).length} models loaded.`);

const providers = [];
const models = [];
const usedProviders = new Set();
let missing = 0;

for (const [litellmProvider, modelMap] of Object.entries(CURATED)) {
  const prov = PROVIDERS[litellmProvider];
  if (!prov) { console.warn(`  ⚠ Unknown provider: ${litellmProvider}`); continue; }

  for (const [litellmKey, label] of Object.entries(modelMap)) {
    const entry = litellm[litellmKey];
    if (!entry) {
      console.warn(`  ⚠ Model not found in LiteLLM: ${litellmKey}`);
      missing++;
      continue;
    }

    const modelName = stripPrefix(litellmKey, litellmProvider);
    const id = `${prov.id}/${modelName}`;
    const contextWindow = entry.max_input_tokens || entry.max_tokens || 128000;
    const vision = entry.supports_vision || false;
    const inputPrice = toMillionTokens(entry.input_cost_per_token);
    const outputPrice = toMillionTokens(entry.output_cost_per_token);

    const model = {
      id,
      providerId: prov.id,
      model: modelName,
      label,
      vision,
      contextWindow,
    };
    if (inputPrice > 0 || outputPrice > 0) {
      model.pricing = { input: inputPrice, output: outputPrice };
    }

    models.push(model);
    usedProviders.add(prov.id);
  }
}

// Collect providers in order
for (const prov of Object.values(PROVIDERS)) {
  if (usedProviders.has(prov.id)) providers.push(prov);
}
for (const prov of MANUAL_PROVIDERS) {
  providers.push(prov);
}

// Add manual models
for (const m of MANUAL_MODELS) models.push(m);

// 把“厂商提供的模型条目”拆成模型本体 + 接入绑定。
// 价格属于绑定，能力与上下文属于模型本体。
const modelMap = new Map();
const bindings = models.map((entry) => {
  const key = entry.model.toLowerCase();
  const existing = modelMap.get(key);
  const modelId = existing?.id || entry.model;
  if (existing) {
    existing.vision ||= entry.vision;
    if ((entry.contextWindow || 0) > (existing.contextWindow || 0)) {
      existing.contextWindow = entry.contextWindow;
    }
  } else {
    const { pricing: _pricing, ...model } = entry;
    modelMap.set(key, { ...model, id: modelId });
  }
  return {
    id: entry.id,
    modelId,
    providerId: entry.providerId,
    apiModelName: entry.model,
    ...(entry.pricing ? { pricing: entry.pricing } : {}),
  };
});

const registry = {
  version: 0,
  updatedAt: new Date().toISOString().slice(0, 10),
  providers,
  models: [...modelMap.values()],
  bindings,
};

// Read current version to bump
try {
  const current = JSON.parse(readFileSync('registry/models.json', 'utf8'));
  registry.version = (current.version || 0) + 1;
} catch {
  registry.version = 1;
}

writeFileSync('registry/models.json', JSON.stringify(registry, null, 2) + '\n');

console.log(`\n✓ registry/models.json generated (v${registry.version})`);
console.log(`  ${providers.length} providers, ${models.length} models`);
if (missing) console.log(`  ${missing} models not found in LiteLLM (skipped)`);
