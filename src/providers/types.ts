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
