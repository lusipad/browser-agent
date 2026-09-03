import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../src/background/session';
import type { AppConfig } from '../../src/shared/types';

function cfgWith(vision: boolean, bindingId = 'p/m'): AppConfig {
  const c = {
    version: 1 as const,
    providers: [{ id: 'p', name: 'P', baseUrl: 'http://p/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: !!vision }],
    bindings: [{ id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm' }],
    defaultBindingId: 'p/m',
    safety: { allowAllSites: false, confirmNewSite: true, confirmPassword: true, confirmJavascript: true, confirmUpload: true },
    advanced: {
      maxIterations: 100, maxImagesKept: 4, maxContextTokens: 96000, screenshotMaxWidth: 1366,
      jpegQuality: 80, temperature: null, maxTokens: 4096, autoScreenshot: true,
      requestTimeoutMs: 180000, maxRetries: 2, setOfMarks: true, planning: true, enableJavascriptTool: false,
    },
    uiLang: 'auto' as const,
    sites: { allowed: [], blocked: [] },
  };
  return { ...c, bindings: [{ ...c.bindings[0], id: bindingId }], defaultBindingId: bindingId } as AppConfig;
}

test('effectiveVision: 默认跟随模型能力', () => {
  const s = new Session(1, cfgWith(true));
  assert.equal(s.effectiveVision(), true, '模型支持视觉 → 默认开启');
  const s2 = new Session(1, cfgWith(false));
  assert.equal(s2.effectiveVision(), false, '模型无视觉 → 默认关闭');
});

test('effectiveVision: 会话级覆盖可关闭视觉（即使模型支持）', () => {
  const s = new Session(1, cfgWith(true));
  s.visionOverride = false;
  assert.equal(s.effectiveVision(), false);
});

test('effectiveVision: 会话级覆盖可强制开启（即使模型未标记）', () => {
  const s = new Session(1, cfgWith(false));
  s.visionOverride = true;
  assert.equal(s.effectiveVision(), true);
});

test('effectiveVision: 模型缺失时回落为开启（能力未知不误关）', () => {
  const s = new Session(1, cfgWith(false));
  s.bindingId = 'p/nope';
  assert.equal(s.effectiveVision(), true);
});

test('新会话重置为跟随模型', () => {
  const s = new Session(1, cfgWith(true));
  s.visionOverride = false;
  assert.equal(s.visionOverride, false);
  s.visionOverride = null;
  assert.equal(s.effectiveVision(), true);
});

test('snapshot 携带 visionOverride', () => {
  const s = new Session(1, cfgWith(false));
  s.visionOverride = true;
  const snap = s.snapshot([]);
  assert.equal(snap.type, 'snapshot');
  if (snap.type === 'snapshot') assert.equal(snap.visionOverride, true);
});

test('toArchived / 恢复时保留视觉覆盖', () => {
  const s = new Session(1, cfgWith(true));
  s.visionOverride = false;
  const conv = s.toArchived();
  assert.equal(conv.visionOverride, false);
});
