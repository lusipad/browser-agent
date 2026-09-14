// OpenAI Chat Completions 适配器
// 同时覆盖所有 OpenAI 兼容端点：DeepSeek、Ollama、OpenRouter、LM Studio、vLLM…
import type { ContentBlock, ImageBlock, TextBlock } from '../shared/types';
import { textOfBlocks, uid } from '../shared/util';
import { endpointUrls } from '../shared/endpoints';
import { sseData } from './sse';
import { HttpError, fetchWithRetry, mergeConsecutive, type ProviderImpl } from './types';

/** o 系列推理模型：不接受 temperature，须用 max_completion_tokens */
function isReasoningModel(model: string): boolean {
  return /^o\d/i.test(model);
}

/** 从 SSE delta 中提取文本：兼容 string 格式和 content-parts 数组格式 */
function extractDeltaText(delta: any): string {
  if (typeof delta.content === 'string') return delta.content;
  if (Array.isArray(delta.content)) {
    let out = '';
    for (const part of delta.content) {
      if (part.type === 'text' && typeof part.text === 'string') out += part.text;
      else if (part.type === 'output_text' && typeof part.text === 'string') out += part.text;
      else if (typeof part.text === 'string') out += part.text;
    }
    return out;
  }
  if (typeof delta.refusal === 'string' && delta.refusal) return `[Refused] ${delta.refusal}`;
  return '';
}

export const openaiStream: ProviderImpl = async (p) => {
  const urls = endpointUrls(p.provider.baseUrl, 'chat/completions');
  if (!urls.length) throw new Error('服务商 Base URL 为空');
  const body: Record<string, unknown> = {
    model: p.binding.apiModelName,
    messages: buildMessages(p.system, mergeConsecutive(p.messages), p.binding.apiModelName),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (p.tools.length) {
    body.tools = p.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.schema },
    }));
  }
  if (isReasoningModel(p.binding.apiModelName)) {
    body.max_completion_tokens = p.maxTokens;
  } else {
    body.max_tokens = p.maxTokens;
    if (p.temperature != null) body.temperature = p.temperature;
  }

  let resp: Response | undefined;
  let lastError: unknown;
  for (const url of urls) {
    try {
      resp = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${p.provider.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { provider: p.provider, signal: p.signal, timeoutMs: p.timeoutMs, retries: p.retries },
      );
      break;
    } catch (e) {
      lastError = e;
      if (!(e instanceof HttpError) || e.status !== 404 || url === urls[urls.length - 1]) throw e;
    }
  }
  if (!resp) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  const contentType = (resp.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('text/event-stream')) {
    throw new Error(
      `接口返回了 ${contentType || '未知 Content-Type'}，不是 SSE 流。请检查服务商 Base URL 是否包含 /v1。`,
    );
  }

  let text = '';
  let reasoningText = '';
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let finish = 'stop';
  let usage: { input: number; output: number } | undefined;

  for await (const data of sseData(resp)) {
    if (data === '[DONE]') break;
    let j: any;
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    if (j.error) {
      throw new HttpError(
        typeof j.error.code === 'number' ? j.error.code : 500,
        p.provider.name,
        j.error.message ?? JSON.stringify(j.error),
      );
    }
    if (j.usage) {
      usage = { input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 };
    }
    const choice = j.choices?.[0];
    if (!choice) continue;
    const d = choice.delta ?? {};
    if (typeof d.reasoning_content === 'string') {
      reasoningText += d.reasoning_content;
    } else if (typeof d.reasoning === 'string') {
      reasoningText += d.reasoning;
    }
    const chunk = extractDeltaText(d);
    if (chunk) {
      text += chunk;
      p.onText(chunk);
    }
    for (const tc of d.tool_calls ?? []) {
      const idx = tc.index ?? 0;
      let cur = calls.get(idx);
      if (!cur) {
        cur = { id: '', name: '', args: '' };
        calls.set(idx, cur);
      }
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) {
        cur.name = cur.name && cur.name === tc.function.name ? cur.name : cur.name + tc.function.name;
      }
      if (tc.function?.arguments) cur.args += tc.function.arguments;
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  }

  const blocks: ContentBlock[] = [];
  if (text) blocks.push({ type: 'text', text });
  for (const [, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    let input: Record<string, unknown> = {};
    try {
      input = c.args ? JSON.parse(c.args) : {};
    } catch {
      input = { __malformed_arguments: c.args.slice(0, 1000) };
    }
    blocks.push({ type: 'tool_use', id: c.id || uid('call'), name: c.name, input });
  }
  return { blocks, stopReason: finish, usage, reasoningText: reasoningText || undefined };
};

function buildMessages(system: string, msgs: ReturnType<typeof mergeConsecutive>, apiModelName?: string): unknown[] {
  const isDeepSeek = /deepseek/i.test(apiModelName ?? '');
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of msgs) {
    if (m.role === 'assistant') {
      const text = textOfBlocks(m.content);
      const toolCalls = m.content
        .filter((b) => b.type === 'tool_use')
        .map((b: any) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      const msg: Record<string, unknown> = { role: 'assistant', content: text || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      if (m.reasoning_content != null) {
        msg.reasoning_content = m.reasoning_content;
      } else if (isDeepSeek && toolCalls.length) {
        msg.reasoning_content = '';
      }
      out.push(msg);
      continue;
    }

    // user 消息：tool 结果必须紧跟在 assistant.tool_calls 之后；
    // OpenAI 的 tool 消息不支持图片 → 截图挪到随后的 user 消息携带
    const carrierImages: unknown[] = [];
    const userParts: Array<Record<string, unknown>> = [];
    for (const b of m.content) {
      if (b.type === 'tool_result') {
        const texts = b.content
          .filter((c): c is TextBlock => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
        const imgs = b.content.filter((c): c is ImageBlock => c.type === 'image');
        out.push({
          role: 'tool',
          tool_call_id: b.toolUseId,
          content:
            (b.isError ? '[ERROR] ' : '') +
            (texts || (imgs.length ? '(screenshot attached in the next user message)' : '(no output)')),
        });
        for (const img of imgs) {
          carrierImages.push({
            type: 'image_url',
            image_url: { url: `data:${img.mediaType};base64,${img.data}` },
          });
        }
      } else if (b.type === 'text') {
        userParts.push({ type: 'text', text: b.text });
      } else if (b.type === 'image') {
        userParts.push({
          type: 'image_url',
          image_url: { url: `data:${b.mediaType};base64,${b.data}` },
        });
      }
    }
    const parts: Array<Record<string, unknown>> = [
      ...(carrierImages.length
        ? [{ type: 'text', text: 'Screenshot(s) captured by the tool call(s) above:' } as Record<string, unknown>]
        : []),
      ...(carrierImages as Array<Record<string, unknown>>),
      ...userParts,
    ];
    if (parts.length) {
      // 纯文本时降级为 string，最大化兼容严格的 OpenAI 兼容服务
      const allText = parts.every((x) => x.type === 'text');
      out.push({
        role: 'user',
        content: allText ? parts.map((x) => x.text as string).join('\n') : parts,
      });
    }
  }
  return out;
}
