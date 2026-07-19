import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROX_IMAGE_TOKENS,
  computeCost,
  estimateBlockTokens,
  estimateTokens,
  formatUsd,
  governContext,
  inputBudgetFor,
  squeezeText,
} from '../../src/shared/context';
import type { ChatMessage, ContentBlock } from '../../src/shared/types';

const img = (): ContentBlock => ({ type: 'image', mediaType: 'image/jpeg', data: 'AAAA' });
const txt = (s: string): ContentBlock => ({ type: 'text', text: s });

// ---------- token 估算 ----------

test('estimateBlockTokens: 图片按固定值，文本按字符数', () => {
  assert.equal(estimateBlockTokens(img()), APPROX_IMAGE_TOKENS);
  const t = estimateBlockTokens(txt('x'.repeat(320)), { charsPerToken: 3.2 });
  assert.equal(t, 100 + 4); // 320/3.2=100 + BLOCK_OVERHEAD
});

test('estimateBlockTokens: tool_result 递归累加内部块', () => {
  const block: ContentBlock = {
    type: 'tool_result',
    toolUseId: 'x',
    toolName: 'read_page',
    content: [txt('hi') as any, img() as any],
  };
  const t = estimateBlockTokens(block);
  assert.ok(t > APPROX_IMAGE_TOKENS); // 至少包含图片 + 文本 + 开销
});

test('estimateTokens: 遍历所有消息', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [txt('hello')] },
    { role: 'assistant', content: [txt('world')] },
  ];
  assert.ok(estimateTokens(msgs) > 0);
});

// ---------- 文本压缩 ----------

test('squeezeText: 短文本原样返回', () => {
  assert.equal(squeezeText('short', 100), 'short');
});

test('squeezeText: 超长保留头尾并标注省略量', () => {
  const s = 'H'.repeat(100) + 'M'.repeat(1000) + 'T'.repeat(100);
  const out = squeezeText(s, 200);
  assert.ok(out.length < s.length);
  assert.ok(out.startsWith('H'));
  assert.ok(out.endsWith('T'));
  assert.match(out, /已省略 \d+ 字/);
});

// ---------- governContext：图片裁剪 ----------

test('governContext: 无视觉模型移除全部图片', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [txt('task')] },
    { role: 'user', content: [img(), txt('page')] },
  ];
  const r = governContext(msgs, { vision: false, maxImages: 4, maxInputTokens: 100000 });
  const images = r.messages.flatMap((m) => m.content).filter((b) => b.type === 'image');
  assert.equal(images.length, 0);
});

test('governContext: 视觉模型仅保留最近 N 张截图', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [txt('task')] },
    { role: 'user', content: [img()] },
    { role: 'user', content: [img()] },
    { role: 'user', content: [img()] },
  ];
  const r = governContext(msgs, { vision: true, maxImages: 2, maxInputTokens: 100000 });
  const images = r.messages.flatMap((m) => m.content).filter((b) => b.type === 'image');
  assert.equal(images.length, 2);
});

test('governContext: 不改动调用方的原始历史', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [txt('task')] },
    { role: 'user', content: [img()] },
  ];
  governContext(msgs, { vision: false, maxImages: 4, maxInputTokens: 100000 });
  assert.equal(msgs[1].content[0].type, 'image'); // 原始未被改写
});

// ---------- governContext：超长结果压缩 ----------

test('governContext: 压缩超长 tool_result 文本', () => {
  const huge = 'A'.repeat(50000);
  const msgs: ChatMessage[] = [
    { role: 'user', content: [txt('task')] },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'get_page_text', input: {} }] },
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 't1', toolName: 'get_page_text', content: [txt(huge)] }],
    },
  ];
  const r = governContext(msgs, { vision: true, maxImages: 4, maxInputTokens: 100000, maxToolResultChars: 2000 });
  assert.equal(r.compressedResults, 1);
  const tr = r.messages.find((m) => m.content.some((b) => b.type === 'tool_result'))!;
  const trBlock = tr.content.find((b) => b.type === 'tool_result') as any;
  assert.ok(trBlock.content[0].text.length < huge.length);
});

// ---------- governContext：token 预算裁剪 ----------

function convo(pairs: number): ChatMessage[] {
  // [原始任务] + pairs 组 (assistant tool_use, user tool_result)
  const msgs: ChatMessage[] = [{ role: 'user', content: [txt('原始任务：请完成一个多步骤操作')] }];
  for (let i = 0; i < pairs; i++) {
    msgs.push({ role: 'assistant', content: [{ type: 'tool_use', id: `t${i}`, name: 'read_page', input: {} }] });
    msgs.push({
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: `t${i}`, toolName: 'read_page', content: [txt('X'.repeat(4000))] }],
    });
  }
  return msgs;
}

test('governContext: 预算充足时不裁剪', () => {
  const msgs = convo(3);
  const r = governContext(msgs, { vision: true, maxImages: 4, maxInputTokens: 1000000 });
  assert.equal(r.trimmedMessages, 0);
  assert.equal(r.messages.length, msgs.length);
});

test('governContext: 超预算时裁掉最旧消息并保留原始任务', () => {
  const msgs = convo(20);
  const r = governContext(msgs, { vision: true, maxImages: 4, maxInputTokens: 8000 });
  assert.ok(r.trimmedMessages > 0);
  // 原始任务始终在首位
  assert.equal(r.messages[0].content[0].type, 'text');
  assert.match((r.messages[0].content[0] as any).text, /原始任务/);
  // 插入了裁剪提示
  assert.match((r.messages[1].content[0] as any).text, /trimmed/i);
  // 最终占用不超预算太多（保留最后一轮可能略超，但应远小于全量）
  assert.ok(r.estInputTokens < estimateTokens(msgs));
});

test('governContext: 裁剪后不以孤儿 tool_result 开头（配对完整）', () => {
  const msgs = convo(20);
  const r = governContext(msgs, { vision: true, maxImages: 4, maxInputTokens: 8000 });
  // 跳过 msg[0]（任务）与 msg[1]（裁剪提示 notice），检查真正的历史切片开头
  const tail = r.messages.slice(2);
  if (tail.length) {
    const first = tail[0];
    const isOrphan = first.role === 'user' && first.content.some((b) => b.type === 'tool_result');
    assert.equal(isOrphan, false);
  }
  // 每个 tool_result 都能在它之前找到配对的 tool_use（无孤儿）
  const seenToolUse = new Set<string>();
  for (const m of r.messages) {
    for (const b of m.content) {
      if (b.type === 'tool_use') seenToolUse.add(b.id);
      if (b.type === 'tool_result') assert.ok(seenToolUse.has(b.toolUseId), `孤儿 tool_result ${b.toolUseId}`);
    }
  }
});

test('governContext: 保留最后一整轮（最新页面状态）', () => {
  const msgs = convo(20);
  const r = governContext(msgs, { vision: true, maxImages: 4, maxInputTokens: 8000 });
  const last = msgs[msgs.length - 1].content.find((b) => b.type === 'tool_result') as any;
  const keptLast = r.messages[r.messages.length - 1].content.find((b) => b.type === 'tool_result') as any;
  assert.equal(keptLast.toolUseId, last.toolUseId);
});

// ---------- 成本 ----------

test('computeCost: 按 100 万 token 单价换算', () => {
  const c = computeCost({ input: 1_000_000, output: 500_000 }, { input: 2, output: 8 });
  assert.equal(c, 2 + 4); // 1M*2 + 0.5M*8
});

test('computeCost: 无计费返回 null', () => {
  assert.equal(computeCost({ input: 100, output: 100 }, undefined), null);
  assert.equal(computeCost({ input: 100, output: 100 }, { input: 0, output: 0 }), null);
});

test('formatUsd: 小额多位、大额两位', () => {
  assert.equal(formatUsd(0), '$0');
  assert.equal(formatUsd(0.0023), '$0.0023');
  assert.equal(formatUsd(0.123), '$0.123');
  assert.equal(formatUsd(12.3456), '$12.35');
});

// ---------- 输入预算 ----------

test('inputBudgetFor: 有上下文窗口时扣除输出与余量', () => {
  assert.equal(inputBudgetFor(128000, 4096, 96000, 2048), 128000 - 4096 - 2048);
});

test('inputBudgetFor: 无窗口时回落兜底预算', () => {
  assert.equal(inputBudgetFor(undefined, 4096, 96000), 96000);
  assert.equal(inputBudgetFor(0, 4096, 96000), 96000);
});
