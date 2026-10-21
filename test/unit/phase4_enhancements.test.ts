import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageAgent } from '../../src/background/reader';
import { Session } from '../../src/background/session';
import { runTurn } from '../../src/background/agent';
import { WebBridgeDaemon } from '../../scripts/webbridge-daemon.mjs';
import { humanInterventionTool } from '../../src/background/tools/human';
import type { AppConfig } from '../../src/shared/types';

function mockConfig(): AppConfig {
  return {
    version: 2,
    providers: [{ id: 'p', name: 'P', baseUrl: 'http://p/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: true }],
    bindings: [{ id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm' }],
    defaultBindingId: 'p/m',
    safety: { allowAllSites: false, confirmNewSite: true, confirmPassword: true, confirmJavascript: true, confirmUpload: true },
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
    webbridge: {
      enabled: false,
      url: 'ws://127.0.0.1:10086/ws',
    },
    uiLang: 'auto',
    sites: { allowed: [], blocked: [] },
  };
}

test('pageAgent: 活体 HUD 与点击波纹命令正常响应', async () => {
  const origWindow = (globalThis as any).window;
  const origDoc = (globalThis as any).document;

  const mockEl = {
    id: '',
    style: {},
    appendChild: () => {},
    remove: () => {},
    querySelector: () => null,
  };
  (globalThis as any).window = { location: { href: 'https://example.com' } };
  (globalThis as any).document = {
    title: 'Test',
    body: mockEl,
    documentElement: mockEl,
    getElementById: () => null,
    createElement: () => mockEl,
  };

  try {
    const res1 = await pageAgent('hud_update', { text: '正在点击 [搜索]', status: 'running' });
    assert.equal(res1?.ok, true);

    const res2 = await pageAgent('pointer_ripple', { x: 120, y: 240, color: '#38bdf8' });
    assert.equal(res2?.ok, true);

    const res3 = await pageAgent('hud_update', { status: 'hidden' });
    assert.equal(res3?.ok, true);
  } finally {
    (globalThis as any).window = origWindow;
    (globalThis as any).document = origDoc;
  }
});

test('pageAgent: extract 支持 auto_cards 自动提取模式', async () => {
  const origWindow = (globalThis as any).window;
  const origDoc = (globalThis as any).document;

  const mockWalker = {
    nextNode: () => null,
  };
  (globalThis as any).window = { location: { href: 'https://store.example.com' } };
  (globalThis as any).document = {
    title: 'Store',
    body: {},
    documentElement: {},
    createTreeWalker: () => mockWalker,
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  try {
    const res = await pageAgent('extract', { mode: 'auto_cards' });
    assert.equal(res?.mode, 'auto_cards');
    assert.ok(Array.isArray(res?.cards));
  } finally {
    (globalThis as any).window = origWindow;
    (globalThis as any).document = origDoc;
  }
});

test('runTurn: /compact 命令就地精简上下文历史并安全返回', async () => {
  const cfg = mockConfig();
  const session = new Session(1, cfg);

  // 模拟堆叠了多轮消息
  session.messages = [
    { role: 'user', content: [{ type: 'text', text: 'turn 1' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'ans 1' }] },
    { role: 'user', content: [{ type: 'text', text: 'turn 2' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'ans 2' }] },
    { role: 'user', content: [{ type: 'text', text: 'turn 3' }] },
  ];

  await runTurn(session, '/compact');

  assert.equal(session.running, false);
  // 验证消息已压缩精简（包含压缩系统提示与最新 2 条消息）
  assert.ok(session.messages.length <= 3);
  assert.ok(session.timeline.some((t) => t.kind === 'info' && t.text.includes('压缩')));
});

test('WebBridgeDaemon: HTTP 健康检查与优雅启停', async () => {
  const testPort = 10089;
  const daemon = new WebBridgeDaemon(testPort);
  await daemon.start();

  try {
    const res = await fetch(`http://127.0.0.1:${testPort}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.connected, false);
  } finally {
    daemon.stop();
  }
});

test('humanInterventionTool: 触发人工介入并在 resolve 后返回恢复结果', async () => {
  const cfg = mockConfig();
  const session = new Session(1, cfg);

  // 异步在 20ms 后自动 resolve
  setTimeout(() => {
    const item = session.timeline.find((t) => t.kind === 'human_intervention');
    if (item) session.resolveHumanIntervention(item.id);
  }, 20);

  const res = await humanInterventionTool.run(
    { session, tabId: 101, isAborted: () => false },
    { reason: 'captcha', instruction: '请滑动完成拼图' },
  );

  assert.ok(res.content[0].text?.includes('Human intervention completed'));
});

test('pageAgent: page_settle 动态稳定检测在无变动时迅速结算', async () => {
  const origWindow = (globalThis as any).window;
  const origDoc = (globalThis as any).document;

  (globalThis as any).window = { location: { href: 'https://spa.example.com' } };
  (globalThis as any).document = {
    title: 'SPA',
    body: {},
    documentElement: {},
  };

  try {
    const res = await pageAgent('page_settle', { timeoutMs: 200, quietMs: 50 });
    assert.equal(res?.settled, true);
    assert.ok(typeof res?.durationMs === 'number');
  } finally {
    (globalThis as any).window = origWindow;
    (globalThis as any).document = origDoc;
  }
});
