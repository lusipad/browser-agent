import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDemonstratedTrajectory } from '../../src/background/recorder';
import { attachRecipesToSkill, parseSkillJson } from '../../src/background/skillGen';
import { resolveSkillSteps, type Skill } from '../../src/shared/skill';
import { WebBridgeClient } from '../../src/background/webbridge';
import type { DemonstratedAction, AppConfig } from '../../src/shared/types';
import { Session } from '../../src/background/session';

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

test('formatDemonstratedTrajectory: 包含 selector 与多层定位信息', () => {
  const actions: DemonstratedAction[] = [
    {
      type: 'click',
      url: 'https://example.com',
      title: 'Example',
      timestamp: Date.now(),
      target: {
        tag: 'button',
        text: 'Submit Order',
        selector: '#submit-btn',
        rect: { x: 100, y: 200, w: 80, h: 32 },
        point: [140, 216],
      },
    },
  ];

  const traj = formatDemonstratedTrajectory(actions);
  assert.ok(traj.includes('#submit-btn'));
  assert.ok(traj.includes('Submit Order'));
  assert.ok(traj.includes('Click button'));
});

test('attachRecipesToSkill: 将录制动作与技能步骤关联生成 StepRecipe', () => {
  const rawSkillJson = JSON.stringify({
    name: 'Search Product',
    description: 'Search product in store',
    icon: '🔍',
    variables: [{ name: 'keyword', label: '关键词', default: 'laptop' }],
    steps: [
      { intent: 'Navigate to store', url: 'https://store.example.com' },
      { intent: 'Type {{keyword}} into search box' },
      { intent: 'Click search button' },
    ],
  });

  const parsed = parseSkillJson(rawSkillJson);
  const actions: DemonstratedAction[] = [
    {
      type: 'navigate',
      url: 'https://store.example.com',
      title: 'Store',
      timestamp: 1,
    },
    {
      type: 'input',
      url: 'https://store.example.com',
      title: 'Store',
      timestamp: 2,
      target: { tag: 'input', selector: 'input[name="q"]', point: [200, 50] },
      value: '{{keyword}}',
    },
    {
      type: 'click',
      url: 'https://store.example.com',
      title: 'Store',
      timestamp: 3,
      target: { tag: 'button', selector: '#search-submit-btn', point: [250, 50] },
    },
  ];

  const equipped = attachRecipesToSkill(parsed, actions);
  assert.equal(equipped.steps.length, 3);
  assert.equal(equipped.steps[0].recipe?.action, 'navigate');
  assert.equal(equipped.steps[1].recipe?.action, 'input');
  assert.equal(equipped.steps[1].recipe?.selector, 'input[name="q"]');
  assert.deepEqual(equipped.steps[1].recipe?.point, [200, 50]);
  assert.equal(equipped.steps[2].recipe?.action, 'click');
  assert.equal(equipped.steps[2].recipe?.selector, '#search-submit-btn');
});

test('resolveSkillSteps: 变量插值时完整保留并替换 StepRecipe 模板', () => {
  const skill: Skill = {
    id: 's1',
    name: 'Test',
    description: 'desc',
    icon: '⚡',
    version: 1,
    variables: [{ name: 'query', label: '查询词', type: 'string', required: true }],
    steps: [
      {
        intent: '输入 {{query}}',
        recipe: {
          action: 'input',
          selector: '#search-input',
          valueTemplate: 'search for {{query}}',
          point: [100, 20],
        },
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };

  const resolved = resolveSkillSteps(skill, { query: 'mechanical keyboard' });
  assert.equal(resolved[0].intent, '输入 mechanical keyboard');
  assert.equal(resolved[0].recipe?.valueTemplate, 'search for mechanical keyboard');
  assert.equal(resolved[0].recipe?.selector, '#search-input');
});

test('WebBridgeClient: 状态查询与初始配置更新', () => {
  const cfg = mockConfig();
  const client = new WebBridgeClient(async () => new Session(1, cfg));
  const status = client.getStatus();

  assert.equal(status.status, 'disconnected');
  assert.equal(status.connected, false);
  assert.ok(status.clientId.startsWith('wb_'));
  assert.equal(status.url, 'ws://127.0.0.1:10086/ws');
});

test('WebBridgeClient: 收到 4409 实例冲突时置为 conflict 并触发安全等待', () => {
  const cfg = mockConfig();
  const client = new WebBridgeClient(async () => new Session(1, cfg));
  client.updateConfig(cfg);

  // 模拟触发 handleClose 4409
  (client as any).handleClose(4409, 'daemon is driven by another browser');
  const status = client.getStatus();

  assert.equal(status.status, 'conflict');
  assert.equal(status.connected, false);
  assert.ok(status.lastError?.includes('4409'));

  client.disconnect();
  assert.equal(client.getStatus().status, 'disconnected');
});
