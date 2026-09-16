import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDemonstratedTrajectory } from '../../src/background/recorder';
import { parseSkillJson } from '../../src/background/skillGen';
import { Session } from '../../src/background/session';
import type { DemonstratedAction, AppConfig } from '../../src/shared/types';

function mockConfig(): AppConfig {
  return {
    version: 1,
    providers: [{ id: 'p', name: 'P', baseUrl: 'http://p/v1', apiKey: 'k' }],
    models: [{ id: 'm', label: 'M', vision: true }],
    bindings: [{ id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm' }],
    defaultBindingId: 'p/m',
    safety: { allowAllSites: false, confirmNewSite: true, confirmPassword: true, confirmJavascript: true, confirmUpload: true },
    advanced: {
      maxIterations: 100, maxImagesKept: 4, maxContextTokens: 96000, screenshotMaxWidth: 1366,
      jpegQuality: 80, temperature: null, maxTokens: 4096, autoScreenshot: true,
      requestTimeoutMs: 180000, maxRetries: 2, setOfMarks: true, planning: true, enableJavascriptTool: false,
    },
    uiLang: 'auto',
    sites: { allowed: [], blocked: [] },
  };
}

test('formatDemonstratedTrajectory - formats clicks, inputs, and uploads', () => {
  const actions: DemonstratedAction[] = [
    {
      type: 'navigate',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 1000,
    },
    {
      type: 'click',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 1500,
      target: {
        tag: 'input',
        placeholder: 'Search goods...',
        role: 'searchbox',
      },
    },
    {
      type: 'input',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 2000,
      target: {
        tag: 'input',
        placeholder: 'Search goods...',
      },
      value: 'ergonomic key',
    },
    {
      type: 'input',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 2500,
      target: {
        tag: 'input',
        placeholder: 'Search goods...',
      },
      value: 'ergonomic keyboard',
    },
    {
      type: 'click',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 3000,
      target: {
        tag: 'button',
        text: 'Search',
      },
    },
    {
      type: 'upload',
      url: 'https://www.example.com/search',
      title: 'Search Engine',
      timestamp: 3500,
      target: {
        tag: 'input',
        label: 'Upload Reference Image',
      },
      value: 'sample.png',
      fileInfo: {
        name: 'sample.png',
        type: 'image/png',
        size: 10240,
      },
    },
  ];

  const formatted = formatDemonstratedTrajectory(actions);

  // Consecutive inputs with same target should be merged/deduped
  assert.doesNotMatch(formatted, /ergonomic key"/);
  assert.match(formatted, /Type "ergonomic keyboard"/);
  assert.match(formatted, /Step 1: Navigate to "https:\/\/www.example.com\/search"/);
  assert.match(formatted, /Click button "Search"/);
  assert.match(formatted, /Upload file "sample.png" \(image\/png, 10240 bytes\)/);
});

test('formatDemonstratedTrajectory - handles empty actions', () => {
  assert.equal(formatDemonstratedTrajectory([]), 'No actions recorded.');
});

test('Session recording lifecycle and state emission', () => {
  const session = new Session(101, mockConfig());
  let emitted: any[] = [];
  session.port = {
    postMessage: (msg: any) => emitted.push(msg),
  } as any;

  assert.equal(session.recording, false);
  assert.equal(session.recordedActions.length, 0);

  // 1. Start recording
  session.startRecording();
  assert.equal(session.recording, true);
  assert.equal(session.recordedActions.length, 0);
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0], {
    type: 'recording_state',
    recording: true,
    count: 0,
    lastAction: undefined,
  });

  // 2. Record click action
  session.recordDemonstratedAction({
    type: 'click',
    url: 'https://test.com',
    title: 'Test',
    timestamp: 100,
    target: { tag: 'button', text: 'Submit' },
  });
  assert.equal(session.recordedActions.length, 1);
  assert.equal(emitted.length, 2);
  assert.equal(emitted[1].type, 'recording_state');
  assert.equal(emitted[1].count, 1);
  assert.equal(emitted[1].lastAction, '点击 "Submit"');

  // 3. Record input action
  session.recordDemonstratedAction({
    type: 'input',
    url: 'https://test.com',
    title: 'Test',
    timestamp: 200,
    target: { tag: 'input', placeholder: 'Name' },
    value: 'Alice',
  });
  assert.equal(session.recordedActions.length, 2);
  assert.equal(emitted[2].count, 2);
  assert.equal(emitted[2].lastAction, '输入 "Alice"');

  // 4. Record file upload
  session.recordDemonstratedAction({
    type: 'upload',
    url: 'https://test.com',
    title: 'Test',
    timestamp: 300,
    target: { tag: 'input' },
    value: 'avatar.jpg',
    fileInfo: { name: 'avatar.jpg', type: 'image/jpeg', size: 2048 },
  });
  assert.equal(session.recordedActions.length, 3);
  assert.equal(emitted[3].count, 3);
  assert.equal(emitted[3].lastAction, '上传文件 "avatar.jpg"');

  // 5. Stop recording
  session.stopRecording();
  assert.equal(session.recording, false);
  assert.equal(emitted[4].recording, false);

  // Actions ignored while not recording
  session.recordDemonstratedAction({
    type: 'click',
    url: 'https://test.com',
    title: 'Test',
    timestamp: 400,
  });
  assert.equal(session.recordedActions.length, 3); // Unchanged
});

test('parseSkillJson - parses demonstrated skill with default values and upload variables', () => {
  const jsonStr = `
  \`\`\`json
  {
    "name": "搜图比价",
    "description": "上传图片并在电商平台比对同款商品价格",
    "icon": "🔍",
    "variables": [
      {
        "name": "ref_image",
        "label": "参考图片",
        "type": "string",
        "required": false,
        "default": "keyboard_sample.png",
        "placeholder": "待搜索的商品图文件名"
      },
      {
        "name": "max_price",
        "label": "最高价格",
        "type": "number",
        "required": false,
        "default": 300,
        "placeholder": "预算上限"
      }
    ],
    "steps": [
      { "intent": "打开图搜页面", "url": "https://example.com/image-search" },
      { "intent": "上传参考图片 {{ref_image}}" },
      { "intent": "筛选价格小于 {{max_price}} 的商品" }
    ]
  }
  \`\`\`
  `;

  const skill = parseSkillJson(jsonStr, 'conv_demo_1');
  assert.equal(skill.name, '搜图比价');
  assert.equal(skill.icon, '🔍');
  assert.equal(skill.variables.length, 2);
  assert.equal(skill.variables[0].name, 'ref_image');
  assert.equal(skill.variables[0].default, 'keyboard_sample.png');
  assert.equal(skill.variables[1].default, 300);
  assert.equal(skill.steps.length, 3);
  assert.equal(skill.sourceConvId, 'conv_demo_1');
});
