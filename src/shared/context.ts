// ============================================================
// 上下文治理：token 估算 + 消息裁剪 + 成本计算
// ------------------------------------------------------------
// 对标 browser-use MessageManager / RooCode 的做法：
//   1. 压缩超长 tool_result（长 read_page / get_page_text 输出）
//   2. 只保留最近 N 张截图，更早的替换为占位文本
//   3. 按 token 预算从最旧消息开始裁剪，直到落入上下文窗口
//   4. 始终保留「系统提示 + 原始任务 + 最近一整轮」，且不破坏
//      tool_use / tool_result 的配对（OpenAI 会拒绝孤儿）
//
// 无 tiktoken 依赖（扩展环境），全部用保守启发式估算：
//   - 文本：chars / 3.2（中英混合偏低取值 → 高估 token 防溢出）
//   - 图片：每张按最坏值 ~1400 token（OpenAI high detail≈765，
//           留足冗余覆盖 Claude / Gemini 更贵的计费）
// ============================================================
import type { ChatMessage, ContentBlock } from './types';

/** 文本 token 估算：每 token 约多少字符（保守偏低，宁可高估） */
export const APPROX_CHARS_PER_TOKEN = 3.2;
/** 每张截图的保守 token 估算 */
export const APPROX_IMAGE_TOKENS = 1400;
/** 每个内容块的固定开销（角色标记 / 分隔符等） */
const BLOCK_OVERHEAD = 4;
/** 单条 tool_result 文本默认上限（字符），超出则压缩中段 */
export const DEFAULT_MAX_TOOL_RESULT_CHARS = 8000;

const TRIM_NOTICE =
  '[Note: earlier steps were trimmed to fit the context window. Rely on the latest page state, screenshots and tool results below.]';

export interface TokenOpts {
  charsPerToken?: number;
  imageTokens?: number;
}

function textTokens(len: number, cpt: number): number {
  return Math.ceil(len / cpt) + BLOCK_OVERHEAD;
}

export function estimateBlockTokens(block: ContentBlock, opts: TokenOpts = {}): number {
  const cpt = opts.charsPerToken ?? APPROX_CHARS_PER_TOKEN;
  const imgTok = opts.imageTokens ?? APPROX_IMAGE_TOKENS;
  switch (block.type) {
    case 'text':
      return textTokens(block.text.length, cpt);
    case 'image':
      return imgTok;
    case 'tool_use':
      return textTokens(block.name.length + JSON.stringify(block.input ?? {}).length, cpt);
    case 'tool_result':
      return block.content.reduce((sum, c) => sum + estimateBlockTokens(c, opts), 0) + BLOCK_OVERHEAD;
    default:
      return BLOCK_OVERHEAD;
  }
}

export function estimateMessageTokens(msg: ChatMessage, opts: TokenOpts = {}): number {
  return msg.content.reduce((sum, b) => sum + estimateBlockTokens(b, opts), BLOCK_OVERHEAD);
}

export function estimateTokens(messages: ChatMessage[], opts: TokenOpts = {}): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m, opts), 0);
}

/** 深拷贝消息数组（不改动调用方的原始历史） */
function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content.map((b) =>
      b.type === 'tool_result' ? { ...b, content: b.content.map((c) => ({ ...c })) } : { ...b },
    ),
  }));
}

/** 压缩单段过长文本：保留头尾，中段省略 */
export function squeezeText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)}\n…[已省略 ${omitted} 字以节省上下文；如需完整内容请重新读取该区域]…\n${text.slice(text.length - tail)}`;
}

/** 就地压缩所有超长 tool_result 文本，返回压缩条数 */
function compressToolResults(messages: ChatMessage[], maxChars: number): number {
  let compressed = 0;
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type !== 'tool_result') continue;
      for (const c of b.content) {
        if (c.type === 'text' && c.text.length > maxChars) {
          c.text = squeezeText(c.text, maxChars);
          compressed++;
        }
      }
    }
  }
  return compressed;
}

/** 就地裁剪图片：只保留最近 maxImages 张，更早的（或无视觉模型的全部）替换为占位文本 */
function trimImages(messages: ChatMessage[], maxImages: number, vision: boolean): void {
  const placeholder = vision
    ? '[older screenshot removed to save context — take a fresh one if needed]'
    : '[screenshot omitted: current model has no vision — use read_page / get_page_text instead]';
  let remaining = vision ? Math.max(0, maxImages) : 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content;
    for (let j = content.length - 1; j >= 0; j--) {
      const b = content[j];
      if (b.type === 'image') {
        if (remaining > 0) remaining--;
        else content[j] = { type: 'text', text: placeholder };
      } else if (b.type === 'tool_result') {
        for (let k = b.content.length - 1; k >= 0; k--) {
          if (b.content[k].type === 'image') {
            if (remaining > 0) remaining--;
            else b.content[k] = { type: 'text', text: placeholder };
          }
        }
      }
    }
  }
}

/** 一条 user 消息是否携带 tool_result（裁剪时不能让它成为切片开头 → 孤儿） */
function isToolResultCarrier(msg: ChatMessage): boolean {
  return msg.role === 'user' && msg.content.some((b) => b.type === 'tool_result');
}

/**
 * 按 token 预算裁剪历史：
 * - messages[0]（原始任务）始终保留
 * - 最后一整轮（最后一个 assistant 起）无条件保留，保证「至少发得出、且看得到最新状态」
 * - 其余从最旧开始丢弃，直到落入预算
 * - 裁剪后若切片开头是 tool_result 载体，则继续前移避免孤儿
 */
function budgetHistory(
  messages: ChatMessage[],
  maxInputTokens: number,
  opts: TokenOpts,
): { messages: ChatMessage[]; trimmed: number } {
  if (messages.length <= 1) return { messages, trimmed: 0 };

  let lastAssistant = -1;
  for (let i = messages.length - 1; i >= 1; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistant = i;
      break;
    }
  }
  const minStart = lastAssistant >= 1 ? lastAssistant : messages.length;

  let acc = estimateMessageTokens(messages[0], opts);
  let start = messages.length;
  for (let i = messages.length - 1; i >= 1; i--) {
    const t = estimateMessageTokens(messages[i], opts);
    if (i >= minStart || acc + t <= maxInputTokens) {
      acc += t;
      start = i;
    } else {
      break;
    }
  }

  // 避免切片以孤儿 tool_result 开头
  while (start < messages.length && isToolResultCarrier(messages[start])) start++;

  if (start <= 1) return { messages, trimmed: 0 };

  const notice: ChatMessage = { role: 'user', content: [{ type: 'text', text: TRIM_NOTICE }] };
  return { messages: [messages[0], notice, ...messages.slice(start)], trimmed: start - 1 };
}

export interface GovernOpts extends TokenOpts {
  /** 当前模型是否支持视觉 */
  vision: boolean;
  /** 历史中保留的最近截图数 */
  maxImages: number;
  /** 输入 token 预算（上下文窗口 − max_tokens − 安全余量） */
  maxInputTokens: number;
  /** 单条 tool_result 文本上限（字符） */
  maxToolResultChars?: number;
}

export interface GovernResult {
  messages: ChatMessage[];
  estInputTokens: number;
  trimmedMessages: number;
  compressedResults: number;
}

/**
 * 发给 API 前的上下文治理主入口（不改动原始历史）。
 * 顺序：压缩超长结果 → 裁剪截图 → 按预算裁剪历史 → 估算最终 token。
 */
export function governContext(messages: ChatMessage[], opts: GovernOpts): GovernResult {
  const clone = cloneMessages(messages);
  const compressedResults = compressToolResults(clone, opts.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS);
  trimImages(clone, opts.maxImages, opts.vision);
  const budgeted = budgetHistory(clone, opts.maxInputTokens, opts);
  return {
    messages: budgeted.messages,
    estInputTokens: estimateTokens(budgeted.messages, opts),
    trimmedMessages: budgeted.trimmed,
    compressedResults,
  };
}

// ------------------------------------------------------------
// 成本估算
// ------------------------------------------------------------

export interface ModelPricing {
  /** 每 100 万输入 token 的美元价 */
  input: number;
  /** 每 100 万输出 token 的美元价 */
  output: number;
}

export function computeCost(
  usage: { input: number; output: number },
  pricing: ModelPricing | undefined | null,
): number | null {
  if (!pricing) return null;
  const inRate = Number(pricing.input) || 0;
  const outRate = Number(pricing.output) || 0;
  if (inRate <= 0 && outRate <= 0) return null;
  return (usage.input / 1e6) * inRate + (usage.output / 1e6) * outRate;
}

/** 成本格式化：小额多保留小数，大额两位 */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n < 0.01) return '$' + n.toFixed(4);
  if (n < 1) return '$' + n.toFixed(3);
  return '$' + n.toFixed(2);
}

/**
 * 输入 token 预算：优先用模型自报的上下文窗口，扣除输出预留与安全余量；
 * 否则回落到全局兜底预算。
 */
export function inputBudgetFor(
  contextWindow: number | undefined,
  maxOutputTokens: number,
  fallbackBudget: number,
  safetyMargin = 2048,
): number {
  if (contextWindow && contextWindow > 0) {
    return Math.max(2048, contextWindow - maxOutputTokens - safetyMargin);
  }
  return Math.max(2048, fallbackBudget);
}
