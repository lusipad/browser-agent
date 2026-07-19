import type { ChatMessage, ContentBlock, ModelConfig, ProviderConfig } from '../shared/types';

export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface StreamParams {
  provider: ProviderConfig;
  model: ModelConfig;
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  temperature: number | null;
  maxTokens: number;
  signal: AbortSignal;
  timeoutMs: number;
  /** 连接阶段失败（5xx/429/网络）的最大退避重试次数 */
  retries: number;
  /** 文本增量回调（用于 UI 流式显示） */
  onText: (delta: string) => void;
}

export interface StreamResult {
  blocks: ContentBlock[];
  stopReason: string;
  usage?: { input: number; output: number };
}

export type ProviderImpl = (p: StreamParams) => Promise<StreamResult>;

/** 合并相邻同角色消息（Anthropic / Gemini 要求角色交替） */
export function mergeConsecutive(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = [...last.content, ...m.content];
    } else {
      out.push({ role: m.role, content: [...m.content] });
    }
  }
  return out;
}

export function combinedSignal(signal: AbortSignal, timeoutMs: number): AbortSignal {
  try {
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  } catch {
    return signal;
  }
}

export async function readErrorBody(resp: Response): Promise<string> {
  try {
    const text = await resp.text();
    return text.slice(0, 500);
  } catch {
    return '(无法读取错误响应体)';
  }
}

// ============================================================
// 连接阶段退避重试 + 错误分类
// ============================================================

/** 携带状态码的 HTTP 错误，便于上层做友好分类 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly providerName: string,
    readonly body: string,
  ) {
    super(`${providerName} HTTP ${status}: ${body}`);
    this.name = 'HttpError';
  }
}

/** 可重试的 HTTP 状态：限流与服务端错误（408 请求超时也算） */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || (status >= 500 && status < 600);
}

/** 用户主动取消或请求超时——不重试，直接向上传播 */
function isAbortLike(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

/** 可被 signal 中断的延时 */
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 指数退避 + 抖动，上限 8s */
function backoffMs(attempt: number): number {
  const base = Math.min(8000, 500 * 2 ** attempt);
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

interface RetryCtx {
  provider: ProviderConfig;
  signal: AbortSignal;
  timeoutMs: number;
  retries: number;
}

/**
 * 仅在「连接建立阶段」重试（fetch 失败或响应非 2xx），保证一旦开始读流就不再重试，
 * 避免重复输出。用户取消 / 超时 / 4xx（除限流类）不重试。
 */
export async function fetchWithRetry(url: string, init: RequestInit, ctx: RetryCtx): Promise<Response> {
  const retries = Math.max(0, ctx.retries || 0);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const resp = await fetch(url, { ...init, signal: combinedSignal(ctx.signal, ctx.timeoutMs) });
      if (resp.ok) return resp;
      const err = new HttpError(resp.status, ctx.provider.name, await readErrorBody(resp));
      if (!isRetryableStatus(resp.status) || attempt === retries) throw err;
      lastErr = err;
    } catch (e) {
      if (isAbortLike(e)) throw e; // 取消 / 超时：不重试
      if (e instanceof HttpError && !isRetryableStatus(e.status)) throw e;
      if (attempt === retries) throw e;
      lastErr = e;
    }
    await abortableDelay(backoffMs(attempt), ctx.signal);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 把底层错误翻译成面向用户的中文提示 */
export function classifyProviderError(e: unknown): string {
  if (e instanceof HttpError) {
    const body = e.body ? `：${e.body.slice(0, 200)}` : '';
    if (e.status === 401 || e.status === 403)
      return `API Key 无效或无权限（HTTP ${e.status}）。请到设置页检查该服务商的 Key。`;
    if (e.status === 404)
      return `接口或模型不存在（HTTP 404）。检查服务商 baseUrl 是否含 /v1，以及模型名是否正确。`;
    if (e.status === 429) return `触发限流（HTTP 429），重试后仍失败。请稍后再试或降低请求频率。`;
    if (e.status >= 500) return `服务端错误（HTTP ${e.status}），重试后仍失败。请稍后再试。`;
    if (e.status === 400) return `请求被拒绝（HTTP 400）${body}。可能是模型不支持某个参数或消息格式。`;
    return `${e.providerName} 请求失败（HTTP ${e.status}）${body}`;
  }
  if (e instanceof DOMException && e.name === 'TimeoutError') return '';
  if (e instanceof DOMException && e.name === 'AbortError') return '';
  if (e instanceof TypeError)
    return '无法连接到服务端。请检查网络、服务商 baseUrl，或本地服务（Ollama / LM Studio 等）是否已启动。';
  return e instanceof Error ? e.message : String(e);
}
