import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../../src/background/session';
import { humanInterventionTool } from '../../src/background/tools/human';
import type { AppConfig } from '../../src/shared/types';

function makeMockConfig(): AppConfig {
  return {
    version: 1 as any,
    providers: [{ id: 'p', name: 'P', baseUrl: 'http://p/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: true }],
    bindings: [{ id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm', enabled: true }],
    defaultBindingId: 'p/m',
    safety: { allowAllSites: false, confirmNewSite: true, confirmPassword: true, confirmJavascript: true, confirmUpload: true },
    advanced: {
      maxIterations: 10, maxImagesKept: 2, maxContextTokens: 4000, screenshotMaxWidth: 1000,
      jpegQuality: 80, temperature: null, maxTokens: 1000, autoScreenshot: false,
      requestTimeoutMs: 10000, maxRetries: 1, setOfMarks: false, planning: false, enableJavascriptTool: false,
    },
    uiLang: 'zh',
    sites: { allowed: [], blocked: [] },
  };
}

test('human_intervention: Session 挂起并在 resolve 后恢复执行', async () => {
  const notificationsCreated: Array<{ id: string; opt: any }> = [];
  (globalThis as any).chrome = (globalThis as any).chrome || {};
  (globalThis as any).chrome.notifications = {
    create: (id: string, opt: any) => {
      notificationsCreated.push({ id, opt });
    },
  };
  (globalThis as any).chrome.runtime = {
    getURL: (p: string) => `chrome-extension://test/${p}`,
  };

  const session = new Session(101, makeMockConfig());

  let resolved = false;
  const interventionPromise = session.requestHumanIntervention({
    title: '请完成滑块验证',
    hint: '请在页面上将滑块拖动到缺口处',
    reason: 'slider',
  }).then(() => {
    resolved = true;
  });

  // 挂起状态检查
  assert.equal(resolved, false, '未收到用户确认前应保持挂起');
  assert.equal(session.timeline.length, 1);
  const item = session.timeline[0];
  assert.equal(item.kind, 'human_intervention');
  if (item.kind === 'human_intervention') {
    assert.equal(item.status, 'waiting');
    assert.equal(item.reason, 'slider');
    assert.equal(item.title, '请完成滑块验证');
    assert.equal(item.hint, '请在页面上将滑块拖动到缺口处');
  }

  // 验证桌面通知已触发
  assert.equal(notificationsCreated.length, 1);
  assert.ok(notificationsCreated[0].id.startsWith('human_intervention:'));
  assert.equal(notificationsCreated[0].opt.title, '请完成滑块验证');

  // 用户点击“已完成验证”
  session.resolveHumanIntervention(item.id);
  await interventionPromise;

  // 恢复状态检查
  assert.equal(resolved, true, 'resolve 后 Promise 应当正常履约');
  const updatedItem = session.timeline.find((x) => x.id === item.id);
  assert.ok(updatedItem);
  assert.equal(updatedItem.kind, 'human_intervention');
  if (updatedItem.kind === 'human_intervention') {
    assert.equal(updatedItem.status, 'resolved');
    assert.ok(typeof updatedItem.resolvedAt === 'number');
  }
});

test('human_intervention: Session abort 时安全清理挂起状态', async () => {
  const session = new Session(102, makeMockConfig());

  let finished = false;
  const p = session.requestHumanIntervention({
    hint: '等待人工输入短信验证码',
    reason: 'sms_code',
  }).then(() => {
    finished = true;
  });

  assert.equal(finished, false);
  session.abort();
  await p;

  assert.equal(finished, true, 'abort 应解除挂起不造成死锁');
  assert.equal(session.aborted, true);
});

test('human_intervention: 工具 request_human_intervention 调用链路', async () => {
  const session = new Session(103, makeMockConfig());
  let resumed = false;

  const toolPromise = humanInterventionTool.run(
    { session, tabId: 1 },
    { reason: 'captcha', instruction: '请在页面中点选倒立的文字' },
  );

  assert.equal(session.timeline.length, 1);
  const item = session.timeline[0];
  assert.equal(item.kind, 'human_intervention');

  // 模拟用户点击恢复
  setTimeout(() => {
    session.resolveHumanIntervention(item.id);
    resumed = true;
  }, 10);

  const out = await toolPromise;
  assert.equal(resumed, true);
  assert.equal(out.isError, undefined);
  assert.ok(out.content[0].text.includes('Human intervention completed'));
});
