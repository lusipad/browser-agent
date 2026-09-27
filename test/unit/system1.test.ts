import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStateForSystem1,
  parseSystem1Response,
  executeSystem1Decision,
  type System1Element,
} from '../../src/system1';
import { DEFAULT_CONFIG, mergeConfig } from '../../src/shared/settings';
import { extractLocalSecrets, mergeLocalSecrets } from '../../src/shared/syncStorage';

const mockElements: System1Element[] = [
  { ref: '1', role: 'button', name: 'Submit', inView: true },
  { ref: '2', role: 'textbox', name: 'Search', inView: true },
  { ref: '3', role: 'link', name: 'Next Page', inView: false },
];

test('formatStateForSystem1: 完整拼接目标、页面元信息与元素索引表', () => {
  const formatted = formatStateForSystem1({
    goal: 'Click Submit button',
    elements: mockElements,
    pageUrl: 'https://example.com/form',
    pageTitle: 'Example Form',
    stepContext: 'Step 1: fill and submit',
  });

  assert.ok(formatted.includes('Goal: Click Submit button'));
  assert.ok(formatted.includes('URL: https://example.com/form'));
  assert.ok(formatted.includes('Title: Example Form'));
  assert.ok(formatted.includes('Context: Step 1: fill and submit'));
  assert.ok(formatted.includes('[1] <button> "Submit"'));
  assert.ok(formatted.includes('[2] <textbox> "Search"'));
  assert.ok(formatted.includes('[3] <link> "Next Page" (offscreen)'));
});

test('parseSystem1Response: 解析 TypeSafe Jev 格式 (decisions)', () => {
  const raw = {
    decisions: {
      action: { choice: 'CLICK', score: 0.95 },
      target: { choice: '1', score: 0.91 },
    },
  };
  const parsed = parseSystem1Response(raw, mockElements);
  assert.equal(parsed.action, 'CLICK');
  assert.equal(parsed.targetRef, '1');
  assert.equal(parsed.confidence, 0.91);
});

test('parseSystem1Response: 解析扁平结构 (Laya / jev-ultrafast)', () => {
  const raw = {
    action: 'SCROLL_DOWN',
    confidence: 0.88,
    rationale: 'Content below viewport',
  };
  const parsed = parseSystem1Response(raw, mockElements);
  assert.equal(parsed.action, 'SCROLL_DOWN');
  assert.equal(parsed.confidence, 0.88);
  assert.equal(parsed.rationale, 'Content below viewport');
});

test('parseSystem1Response: 解析 TYPE_TEXT 与指定输入内容', () => {
  const raw = {
    action: 'TYPE_TEXT',
    ref: '2',
    text: 'DeepSeek',
    confidence: 0.94,
  };
  const parsed = parseSystem1Response(raw, mockElements);
  assert.equal(parsed.action, 'TYPE_TEXT');
  assert.equal(parsed.targetRef, '2');
  assert.equal(parsed.text, 'DeepSeek');
  assert.equal(parsed.confidence, 0.94);
});

test('parseSystem1Response: 目标 ref 不在候选列表时降低置信度', () => {
  const raw = {
    action: 'CLICK',
    ref: '999', // 不在 mockElements 中
    confidence: 0.95,
  };
  const parsed = parseSystem1Response(raw, mockElements);
  assert.equal(parsed.action, 'CLICK');
  assert.equal(parsed.targetRef, '999');
  assert.ok(parsed.confidence <= 0.4);
});

test('parseSystem1Response: 未知动作回退至 BLOCKED', () => {
  const raw = {
    action: 'UNKNOWN_OP',
    confidence: 0.99,
  };
  const parsed = parseSystem1Response(raw, mockElements);
  assert.equal(parsed.action, 'BLOCKED');
});

test('executeSystem1Decision: 请求 TypeSafe 端点并携带 API Key', async () => {
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = JSON.parse(String(init?.body || '{}'));
    return new Response(
      JSON.stringify({
        decisions: {
          action: { choice: 'CLICK', score: 0.93 },
          target: { choice: '1', score: 0.9 },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as any;

  try {
    const res = await executeSystem1Decision(
      {
        enabled: true,
        provider: 'typesafe',
        baseUrl: 'https://api.typesafe.ai/v1',
        apiKey: 'test-ts-key',
        model: 'jev',
        minConfidence: 0.6,
        maxConsecutiveFastSteps: 8,
      },
      {
        goal: 'Submit the form',
        elements: mockElements,
        pageUrl: 'https://example.com',
      },
    );

    assert.equal(capturedUrl, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-ts-key');
    assert.equal(capturedBody.model, 'jev');
    assert.equal(res.action, 'CLICK');
    assert.equal(res.targetRef, '1');
    assert.equal(res.confidence, 0.9);
    assert.ok(typeof res.latencyMs === 'number');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('executeSystem1Decision: 请求 Laya 本地端点 (无需 API Key)', async () => {
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return new Response(
      JSON.stringify({
        action: 'SCROLL_DOWN',
        confidence: 0.85,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as any;

  try {
    const res = await executeSystem1Decision(
      {
        enabled: true,
        provider: 'laya-local',
        baseUrl: 'http://localhost:8000/v1',
        apiKey: '',
        model: 'laya-modernbert-large',
        minConfidence: 0.6,
        maxConsecutiveFastSteps: 8,
      },
      {
        goal: 'Scroll to find reviews',
        elements: mockElements,
      },
    );

    assert.equal(capturedUrl, 'http://localhost:8000/v1/decision');
    assert.equal(capturedHeaders['Authorization'], undefined);
    assert.equal(res.action, 'SCROLL_DOWN');
    assert.equal(res.confidence, 0.85);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('settings: mergeConfig 正确载入与默认合并 system1 配置', () => {
  const merged = mergeConfig({
    system1: {
      enabled: true,
      provider: 'laya-local',
      minConfidence: 0.75,
    },
  });

  assert.equal(merged.system1?.enabled, true);
  assert.equal(merged.system1?.provider, 'laya-local');
  assert.equal(merged.system1?.minConfidence, 0.75);
  // 未覆写的字段回退默认
  assert.equal(merged.system1?.model, DEFAULT_CONFIG.system1?.model);
  assert.equal(merged.system1?.maxConsecutiveFastSteps, 8);
});

test('syncStorage: extractLocalSecrets 隔离 system1 API Key 并成功合并还原', () => {
  const config = mergeConfig({
    system1: {
      enabled: true,
      provider: 'typesafe',
      apiKey: 'secret-typesafe-key-123',
    },
    sync: {
      enabled: true,
      syncApiKeys: false,
    },
  });

  const { sanitized, secrets } = extractLocalSecrets(config);
  // 云同步配置中应被脱敏隔离
  assert.equal(sanitized.system1?.apiKey, '');
  assert.equal(secrets['__system1__'], 'secret-typesafe-key-123');

  // 本地还原应重新合并回原密钥
  const restored = mergeLocalSecrets(sanitized, secrets);
  assert.equal(restored.system1?.apiKey, 'secret-typesafe-key-123');
});
