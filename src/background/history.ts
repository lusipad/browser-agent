// 会话归档：把非当前会话持久化到 chrome.storage.local，支持列表 / 切换 / 删除。
// 为控制配额，归档时丢弃 base64 截图（历史会话主要用于查看与继续，继续时会重新截图）。
import type { ChatMessage, ConvMeta, TimelineItem } from '../shared/types';

export interface ArchivedConv extends ConvMeta {
  messages: ChatMessage[];
  timeline: TimelineItem[];
  modelId: string;
  usage: { input: number; output: number };
}

const INDEX_KEY = 'conv_index';
const convKey = (id: string) => `conv:${id}`;
const MAX_CONVERSATIONS = 100;

/** 丢弃消息与时间线中的 base64 截图，压缩归档体积 */
function slim(conv: ArchivedConv): ArchivedConv {
  const messages = conv.messages.map((m) => ({
    role: m.role,
    content: m.content.map((b) => {
      if (b.type === 'image') return { type: 'text' as const, text: '[screenshot]' };
      if (b.type === 'tool_result')
        return {
          ...b,
          content: b.content.map((c) => (c.type === 'image' ? { type: 'text' as const, text: '[screenshot]' } : c)),
        };
      return b;
    }),
  }));
  const timeline = conv.timeline.map((it) =>
    it.kind === 'tool' && it.images ? { ...it, images: it.images.map(() => null) } : it,
  );
  return { ...conv, messages, timeline };
}

export async function listConversations(): Promise<ConvMeta[]> {
  try {
    const idx = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] as ConvMeta[] | undefined;
    return Array.isArray(idx) ? idx.slice().sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

async function writeIndex(list: ConvMeta[]): Promise<void> {
  await chrome.storage.local.set({ [INDEX_KEY]: list });
}

/** 保存 / 更新一个归档会话；空会话（无消息）不落盘 */
export async function saveConversation(conv: ArchivedConv): Promise<void> {
  if (!conv.messages.length) return;
  const meta: ConvMeta = { id: conv.id, title: conv.title, updatedAt: conv.updatedAt, msgCount: conv.msgCount };
  const list = (await listConversations()).filter((c) => c.id !== conv.id);
  list.unshift(meta);

  // 超量时淘汰最旧
  const overflow = list.slice(MAX_CONVERSATIONS);
  const kept = list.slice(0, MAX_CONVERSATIONS);
  try {
    await chrome.storage.local.set({ [convKey(conv.id)]: slim(conv) });
    await writeIndex(kept);
    if (overflow.length) await chrome.storage.local.remove(overflow.map((c) => convKey(c.id)));
  } catch {
    /* 配额不足等：放弃本次归档，不阻塞主流程 */
  }
}

export async function loadConversation(id: string): Promise<ArchivedConv | null> {
  try {
    const data = (await chrome.storage.local.get(convKey(id)))[convKey(id)] as ArchivedConv | undefined;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const list = (await listConversations()).filter((c) => c.id !== id);
  await writeIndex(list);
  await chrome.storage.local.remove(convKey(id));
}
