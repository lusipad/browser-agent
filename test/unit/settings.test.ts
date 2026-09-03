import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, DEFAULT_CONFIG } from '../../src/shared/settings';

test('mergeConfig: 空输入回落默认', () => {
  const c = mergeConfig(undefined);
  assert.equal(c.version, 2);
  assert.ok(c.providers.length > 0);
  assert.ok(c.models.length > 0);
  assert.equal(c.defaultBindingId, DEFAULT_CONFIG.defaultBindingId);
});

test('mergeConfig: 部分 advanced 字段与默认合并', () => {
  const c = mergeConfig({ advanced: { maxIterations: 99 } });
  assert.equal(c.advanced.maxIterations, 99);
  // 未提供的字段回落默认
  assert.equal(c.advanced.setOfMarks, DEFAULT_CONFIG.advanced.setOfMarks);
  assert.equal(c.advanced.planning, DEFAULT_CONFIG.advanced.planning);
  assert.equal(c.advanced.jpegQuality, DEFAULT_CONFIG.advanced.jpegQuality);
});

test('mergeConfig: 保留自定义 providers/models', () => {
  const c = mergeConfig({
    providers: [{ id: 'x', name: 'X', baseUrl: 'http://x/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: false }],
    bindings: [{ id: 'x/m', modelId: 'm', providerId: 'x', apiModelName: 'm' }],
  });
  assert.equal(c.providers.length, 1);
  assert.equal(c.providers[0].id, 'x');
  assert.equal(c.models[0].vision, false);
});

test('mergeConfig: v1 配置迁移为独立模型与多个厂商绑定', () => {
  const c = mergeConfig({
    version: 1,
    providers: [
      { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'a' },
      { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'b' },
    ],
    models: [
      { id: 'openai/gpt-4', providerId: 'openai', model: 'gpt-4', label: 'GPT-4', vision: true, pricing: { input: 10, output: 30 } },
      { id: 'openrouter/GPT-4', providerId: 'openrouter', model: 'GPT-4', label: 'GPT-4 (OR)', vision: true, contextWindow: 200000 },
    ],
    defaultModelId: 'openrouter/GPT-4',
  });
  assert.equal(c.version, 2);
  assert.equal(c.models.length, 1);
  assert.equal(c.models[0].id, 'gpt-4');
  assert.equal(c.models[0].contextWindow, 200000);
  assert.deepEqual(c.bindings.map((b) => b.id), ['openai/gpt-4', 'openrouter/GPT-4']);
  assert.equal(c.defaultBindingId, 'openrouter/GPT-4');
  assert.equal(c.bindings.every((b) => b.enabled === true), true);
});

test('mergeConfig: 禁用默认接入时自动选择第一个启用接入', () => {
  const c = mergeConfig({
    providers: [{ id: 'p', name: 'P', baseUrl: 'http://p/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: false }],
    bindings: [
      { id: 'p/m1', modelId: 'm', providerId: 'p', apiModelName: 'm1', enabled: false },
      { id: 'p/m2', modelId: 'm', providerId: 'p', apiModelName: 'm2' },
    ],
    defaultBindingId: 'p/m1',
  });
  assert.equal(c.defaultBindingId, 'p/m2');
  assert.equal(c.bindings[0].enabled, false);
  assert.equal(c.bindings[1].enabled, true);
});

test('mergeConfig: sites 分别回落', () => {
  const c = mergeConfig({ sites: { allowed: ['a.com'] } as any });
  assert.deepEqual(c.sites.allowed, ['a.com']);
  assert.ok(c.sites.blocked.length > 0, '未提供的 blocked 回落默认黑名单');
});

test('DEFAULT_CONFIG: 每个模型引用存在的服务商', () => {
  const providerIds = new Set(DEFAULT_CONFIG.providers.map((p) => p.id));
  const modelIds = new Set(DEFAULT_CONFIG.models.map((m) => m.id));
  for (const b of DEFAULT_CONFIG.bindings) {
    assert.ok(providerIds.has(b.providerId), `${b.id} 的 providerId 存在`);
    assert.ok(modelIds.has(b.modelId), `${b.id} 的 modelId 存在`);
  }
  assert.ok(DEFAULT_CONFIG.bindings.some((b) => b.id === DEFAULT_CONFIG.defaultBindingId), '默认接入存在');
});

test('DEFAULT_CONFIG: GPT-5.6 默认使用服务商实际提供的 Terra 模型名', () => {
  assert.equal(DEFAULT_CONFIG.defaultBindingId, 'openai/gpt-5.6-terra');
  assert.ok(DEFAULT_CONFIG.bindings.some((b) => b.apiModelName === 'gpt-5.6-sol'));
  assert.ok(DEFAULT_CONFIG.bindings.some((b) => b.apiModelName === 'gpt-5.6-terra'));
  assert.ok(!DEFAULT_CONFIG.bindings.some((b) => b.apiModelName === 'gpt-5.6'));
});

test('DEFAULT_CONFIG: 单轮迭代上限为 100', () => {
  assert.equal(DEFAULT_CONFIG.advanced.maxIterations, 100);
});
