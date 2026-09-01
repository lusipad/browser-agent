import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, DEFAULT_CONFIG } from '../../src/shared/settings';

test('mergeConfig: 空输入回落默认', () => {
  const c = mergeConfig(undefined);
  assert.equal(c.version, 1);
  assert.ok(c.providers.length > 0);
  assert.ok(c.models.length > 0);
  assert.equal(c.defaultModelId, DEFAULT_CONFIG.defaultModelId);
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
    models: [{ id: 'x/m', providerId: 'x', model: 'm', label: 'M', vision: false }],
  });
  assert.equal(c.providers.length, 1);
  assert.equal(c.providers[0].id, 'x');
  assert.equal(c.models[0].vision, false);
});

test('mergeConfig: sites 分别回落', () => {
  const c = mergeConfig({ sites: { allowed: ['a.com'] } as any });
  assert.deepEqual(c.sites.allowed, ['a.com']);
  assert.ok(c.sites.blocked.length > 0, '未提供的 blocked 回落默认黑名单');
});

test('DEFAULT_CONFIG: 每个模型引用存在的服务商', () => {
  const ids = new Set(DEFAULT_CONFIG.providers.map((p) => p.id));
  for (const m of DEFAULT_CONFIG.models) assert.ok(ids.has(m.providerId), `${m.id} 的 providerId 存在`);
  assert.ok(DEFAULT_CONFIG.models.some((m) => m.id === DEFAULT_CONFIG.defaultModelId), '默认模型存在');
});

test('DEFAULT_CONFIG: GPT-5.6 默认使用服务商实际提供的 Terra 模型名', () => {
  assert.equal(DEFAULT_CONFIG.defaultModelId, 'openai/gpt-5.6-terra');
  assert.ok(DEFAULT_CONFIG.models.some((m) => m.model === 'gpt-5.6-sol'));
  assert.ok(DEFAULT_CONFIG.models.some((m) => m.model === 'gpt-5.6-terra'));
  assert.ok(!DEFAULT_CONFIG.models.some((m) => m.model === 'gpt-5.6'));
});

test('DEFAULT_CONFIG: 单轮迭代上限为 100', () => {
  assert.equal(DEFAULT_CONFIG.advanced.maxIterations, 100);
});
