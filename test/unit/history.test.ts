import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteConversation,
  listConversations,
  loadConversation,
  saveConversation,
  type ArchivedConv,
} from '../../src/background/history';
import type { ChatMessage, TimelineItem } from '../../src/shared/types';

/** 有状态的内存 storage.local，替换 chrome-stub 的 no-op */
function installMemStorage() {
  const store = new Map<string, unknown>();
  (globalThis as any).chrome.storage.local = {
    get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
    set: async (obj: Record<string, unknown>) => {
      for (const k of Object.keys(obj)) store.set(k, obj[k]);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
  };
  return store;
}

function conv(id: string, title: string, updatedAt: number, extra?: Partial<ArchivedConv>): ArchivedConv {
  const messages: ChatMessage[] = [{ role: 'user', content: [{ type: 'text', text: title }] }];
  return { id, title, updatedAt, msgCount: messages.length, messages, timeline: [], modelId: 'm', usage: { input: 0, output: 0 }, ...extra };
}

test('history: 保存后可在列表与详情中读到', async () => {
  installMemStorage();
  await saveConversation(conv('c1', '任务一', 1000));
  const list = await listConversations();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'c1');
  assert.equal(list[0].title, '任务一');
  const loaded = await loadConversation('c1');
  assert.ok(loaded);
  assert.equal(loaded!.messages.length, 1);
});

test('history: 列表按 updatedAt 倒序', async () => {
  installMemStorage();
  await saveConversation(conv('a', 'A', 1000));
  await saveConversation(conv('b', 'B', 3000));
  await saveConversation(conv('c', 'C', 2000));
  const list = await listConversations();
  assert.deepEqual(
    list.map((x) => x.id),
    ['b', 'c', 'a'],
  );
});

test('history: 空会话不落盘', async () => {
  installMemStorage();
  await saveConversation({ ...conv('e', '', 1000), messages: [], msgCount: 0 });
  assert.equal((await listConversations()).length, 0);
});

test('history: 归档丢弃 base64 截图', async () => {
  installMemStorage();
  const messages: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: '看这个' }, { type: 'image', mediaType: 'image/jpeg', data: 'BIG' }] },
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 't', toolName: 'screenshot', content: [{ type: 'image', mediaType: 'image/jpeg', data: 'BIG' }] }],
    },
  ];
  const timeline: TimelineItem[] = [{ kind: 'tool', id: 't1', name: 'screenshot', summary: '', status: 'ok', images: ['data:image/jpeg;base64,BIG'] }];
  await saveConversation({ id: 's', title: '看这个', updatedAt: 1, msgCount: 2, messages, timeline, modelId: 'm', usage: { input: 0, output: 0 } });
  const loaded = await loadConversation('s');
  const flat = loaded!.messages.flatMap((m) => m.content);
  assert.equal(flat.some((b) => b.type === 'image'), false, '顶层图片被移除');
  const tr = loaded!.messages[1].content[0];
  assert.equal((tr as any).content.some((c: any) => c.type === 'image'), false, 'tool_result 内图片被移除');
  const shot = loaded!.timeline[0];
  assert.deepEqual((shot as any).images, [null], '时间线截图被清空');
});

test('history: 删除会话同时清索引与详情', async () => {
  installMemStorage();
  await saveConversation(conv('x', 'X', 1000));
  await saveConversation(conv('y', 'Y', 2000));
  await deleteConversation('x');
  const list = await listConversations();
  assert.deepEqual(
    list.map((c) => c.id),
    ['y'],
  );
  assert.equal(await loadConversation('x'), null);
});

test('history: 同 id 再保存为更新而非重复', async () => {
  installMemStorage();
  await saveConversation(conv('u', '旧标题', 1000));
  await saveConversation(conv('u', '新标题', 2000));
  const list = await listConversations();
  assert.equal(list.length, 1);
  assert.equal(list[0].title, '新标题');
});
