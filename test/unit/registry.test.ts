import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRegistryMetadata, normalizeRegistry, type RegistryData } from '../../src/shared/registry';
import type { ModelBinding, ModelConfig } from '../../src/shared/types';

const baseModels: ModelConfig[] = [
  { id: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: 128000 },
];

const baseBindings: ModelBinding[] = [
  { id: 'openai/gpt-4', modelId: 'gpt-4', providerId: 'openai', apiModelName: 'gpt-4', pricing: { input: 10, output: 30 } },
];

function registry(overrides: Partial<RegistryData> = {}): RegistryData {
  return {
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: baseModels,
    bindings: baseBindings,
    ...overrides,
  };
}

test('diffRegistryMetadata: 忽略注册表中的新 Provider、模型和接入', () => {
  const d = diffRegistryMetadata(
    registry({
      models: [...baseModels, { id: 'gpt-5', label: 'GPT-5', vision: true, contextWindow: 200000 }],
      bindings: [...baseBindings, { id: 'other-id', modelId: 'gpt-5', providerId: 'new-provider', apiModelName: 'gpt-5', pricing: { input: 5, output: 15 } }],
      providers: [
        ...registry().providers,
        { id: 'new-provider', name: 'New Provider', baseUrl: 'https://new.example/v1' },
      ],
    }),
    baseModels,
    baseBindings,
  );
  assert.equal(d.updatedModels.length, 0);
  assert.equal(d.updatedBindings.length, 0);
});

test('diffRegistryMetadata: 按 providerId + apiModelName 匹配价格，不依赖 Binding ID', () => {
  const localBindings = [{ ...baseBindings[0], id: 'binding-local-generated' }];
  const d = diffRegistryMetadata(
    registry({ bindings: [{ ...baseBindings[0], id: 'registry-stable-id', pricing: { input: 5, output: 15 } }] }),
    baseModels,
    localBindings,
  );
  assert.equal(d.updatedBindings.length, 1);
  assert.equal(d.updatedBindings[0].local.id, 'binding-local-generated');
  assert.equal(d.updatedBindings[0].remote.pricing?.input, 5);
});

test('diffRegistryMetadata: 不把其他 Provider 的同名模型价格套到自定义 Endpoint', () => {
  const d = diffRegistryMetadata(
    registry({
      bindings: [{ ...baseBindings[0], pricing: { input: 5, output: 15 } }],
    }),
    baseModels,
    [{ ...baseBindings[0], providerId: 'company-proxy' }],
  );
  assert.equal(d.updatedBindings.length, 0);
});

test('diffRegistryMetadata: 相同配置没有更新', () => {
  const d = diffRegistryMetadata(registry(), baseModels, baseBindings);
  assert.equal(d.updatedModels.length, 0);
  assert.equal(d.updatedBindings.length, 0);
});

test('diffRegistryMetadata: 模型 ID 忽略大小写并检测能力变化', () => {
  const d = diffRegistryMetadata(
    registry({ models: [{ ...baseModels[0], id: 'GPT-4', contextWindow: 256000 }] }),
    baseModels,
    baseBindings,
  );
  assert.equal(d.updatedModels.length, 1);
  assert.equal(d.updatedModels[0].remote.contextWindow, 256000);
});

test('diffRegistryMetadata: 注册表缺少上下文和价格时不清空用户配置', () => {
  const d = diffRegistryMetadata(
    registry({
      models: [{ id: 'gpt-4', label: 'GPT-4', vision: true }],
      bindings: [{ ...baseBindings[0], pricing: undefined }],
    }),
    baseModels,
    baseBindings,
  );
  assert.equal(d.updatedModels.length, 0);
  assert.equal(d.updatedBindings.length, 0);
});

test('normalizeRegistry: migrates the old provider-bound model format', () => {
  const normalized = normalizeRegistry({
    version: 1,
    updatedAt: '2026-08-31',
    providers: [{ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' }],
    models: [
      { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, pricing: { input: 10, output: 30 } },
    ],
  });
  assert.deepEqual(normalized.models, [{ id: 'gpt-4', label: 'GPT-4', vision: true, contextWindow: undefined }]);
  assert.deepEqual(normalized.bindings, [{
    id: 'openai/gpt-4',
    modelId: 'gpt-4',
    providerId: 'openai',
    apiModelName: 'gpt-4',
    pricing: { input: 10, output: 30 },
    enabled: true,
  }]);
});

test('normalizeRegistry: 同一模型可保留多个厂商绑定', () => {
  const normalized = normalizeRegistry({
    models: [
      { id: 'openai/claude', providerId: 'openai', model: 'claude', label: 'Claude', vision: true, contextWindow: 100000 },
      { id: 'openrouter/claude', providerId: 'openrouter', model: 'claude', label: 'Claude (OR)', vision: true, contextWindow: 200000 },
    ],
  });
  assert.equal(normalized.models.length, 1);
  assert.equal(normalized.models[0].id, 'claude');
  assert.equal(normalized.models[0].contextWindow, 200000);
  assert.deepEqual(
    normalized.bindings.map((b) => [b.providerId, b.apiModelName]),
    [['openai', 'claude'], ['openrouter', 'claude']],
  );
});
