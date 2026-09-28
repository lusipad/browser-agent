import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeT } from '../../src/shared/i18n';
import { toJson, toMarkdown, type ExportMeta } from '../../src/sidepanel/export';
import type { TimelineItem } from '../../src/shared/types';

const META: ExportMeta = { modelLabel: 'GPT-Test', usage: { input: 1200, output: 340, cost: 0.0123 } };

const ITEMS: TimelineItem[] = [
  { kind: 'user', id: 'u1', text: '打开示例网站' },
  { kind: 'assistant', id: 'a1', text: '好的，正在打开。', done: true },
  { kind: 'tool', id: 't1', name: 'navigate', summary: 'https://example.com', status: 'ok', detail: '已到达页面' },
  { kind: 'tool', id: 't2', name: 'screenshot', summary: '', status: 'ok', images: ['data:image/jpeg;base64,AAAA', null] },
  { kind: 'info', id: 'i1', text: '任务完成' },
  { kind: 'error', id: 'e1', text: '出错了' },
];

test('toMarkdown: 含标题、模型、成本与各类消息', () => {
  const md = toMarkdown(ITEMS, META);
  assert.match(md, /# Browser Agent 对话记录/);
  assert.match(md, /GPT-Test/);
  assert.match(md, /\$0\.012/); // formatUsd(0.0123) → $0.012（3 位）
  assert.match(md, /打开示例网站/);
  assert.match(md, /好的，正在打开/);
  assert.match(md, /导航/); // toolLabel(navigate)
  assert.match(md, /example\.com/);
  assert.match(md, /ℹ️ 任务完成/);
  assert.match(md, /⚠️ 出错了/);
});

test('toMarkdown: 折叠多余空行', () => {
  const md = toMarkdown(ITEMS, META);
  assert.ok(!/\n{3,}/.test(md), '不应出现 3 个以上连续换行');
});

test('toMarkdown: 传入英文 t 时输出英文骨架与工具标签', () => {
  const md = toMarkdown(ITEMS, META, makeT('en'));
  assert.match(md, /Browser Agent Conversation/);
  assert.match(md, /Navigate/); // toolLabel(navigate) en
  assert.doesNotMatch(md, /对话记录/);
  assert.doesNotMatch(md, /导航/);
});

test('toJson: 去掉 base64 截图，保留数量标注', () => {
  const parsed = JSON.parse(toJson(ITEMS, META));
  assert.equal(parsed.model, 'GPT-Test');
  assert.equal(parsed.usage.cost, 0.0123);
  const shot = parsed.items.find((x: any) => x.id === 't2');
  assert.equal(shot.images, undefined, 'base64 图片已移除');
  assert.equal(shot.screenshots, 1, '保留有效截图数量');
  assert.equal(parsed.items.length, ITEMS.length);
});

test('toMarkdown: 空会话导出友好提示', () => {
  const md = toMarkdown([], META);
  assert.match(md, /# Browser Agent 对话记录/);
  assert.match(md, /暂无对话记录/);
});

test('download: Chrome 扩展环境下调用 chrome.downloads.download 且处理 lastError', () => {
  const originalChrome = (globalThis as any).chrome;
  let downloadedWith: any = null;
  let retryWith: any = null;

  (globalThis as any).chrome = {
    runtime: { lastError: { message: 'Network failed' } },
    downloads: {
      download: (opts: any, cb: (id?: number) => void) => {
        if (!downloadedWith) {
          downloadedWith = opts;
          // 模拟首次调用失败，触发 lastError
          cb(undefined);
        } else {
          // 模拟兜底 data URL 重试成功
          retryWith = opts;
          (globalThis as any).chrome.runtime.lastError = null;
          cb(123);
        }
      },
    },
  };

  try {
    const { download } = require('../../src/sidepanel/export');
    download('test.md', '# Content', 'text/markdown');
    assert.ok(downloadedWith, '首次应使用 blob url 调用');
    assert.equal(downloadedWith.filename, 'test.md');
    assert.ok(retryWith, '失败后应自动使用 data URL 重试兜底');
    assert.match(retryWith.url, /^data:text\/markdown/);
  } finally {
    (globalThis as any).chrome = originalChrome;
  }
});

