// 智能体主循环：模型流式输出 → 执行工具 → 回填结果 → 迭代
import { openaiStream } from '../providers';
import { buildSystemPrompt } from '../shared/prompts';
import { loadConfig } from '../shared/settings';
import type { ChatMessage, ContentBlock, ImageBlock, ToolUseBlock } from '../shared/types';
import { errText, textOfBlocks, truncate, uid } from '../shared/util';
import type { Session } from './session';
import { executeToolUse, toolSpecs } from './tools/registry';

export async function runTurn(session: Session, userText: string): Promise<void> {
  session.cfg = await loadConfig();
  const model = session.cfg.models.find((m) => m.id === session.modelId);
  if (!model) {
    session.error('未找到所选模型，请到设置页配置模型后重试。');
    return;
  }
  const provider = session.cfg.providers.find((p) => p.id === model.providerId);
  if (!provider) {
    session.error(`模型 ${model.label} 引用的服务商不存在，请检查设置。`);
    return;
  }
  if (!provider.apiKey.trim()) {
    session.error(`「${provider.name}」还没有配置 API Key。点击右上角 ⚙ 打开设置页填写。`);
    return;
  }

  session.running = true;
  session.aborted = false;
  session.controller = new AbortController();
  session.emit({ type: 'run_state', running: true });
  // MV3 Service Worker 保活：运行期间定期调用扩展 API 重置空闲计时器
  const keepalive = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 15000);

  session.messages.push({ role: 'user', content: [{ type: 'text', text: userText }] });
  session.upsert({ kind: 'user', id: uid('u'), text: userText });

  const adv = session.cfg.advanced;
  try {
    for (let iter = 0; iter < adv.maxIterations; iter++) {
      if (session.aborted) break;

      const asstId = uid('a');
      let streamed = '';
      session.upsert({ kind: 'assistant', id: asstId, text: '', done: false });

      const result = await openaiStream({
        provider,
        model,
        system: buildSystemPrompt({
          date: new Date().toISOString().slice(0, 10),
          vision: model.vision,
          screenshotMaxWidth: adv.screenshotMaxWidth,
        }),
        messages: prepareForApi(session.messages, model.vision, adv.maxImagesKept),
        tools: toolSpecs(),
        temperature: adv.temperature,
        maxTokens: adv.maxTokens,
        signal: session.controller.signal,
        timeoutMs: adv.requestTimeoutMs,
        onText: (delta) => {
          streamed += delta;
          session.emit({ type: 'text_delta', id: asstId, delta });
        },
      });

      if (result.usage) {
        session.usage.input += result.usage.input;
        session.usage.output += result.usage.output;
        session.emit({ type: 'usage', input: session.usage.input, output: session.usage.output });
      }

      const finalText = textOfBlocks(result.blocks) || streamed;
      session.upsert({ kind: 'assistant', id: asstId, text: finalText, done: true });
      session.messages.push({
        role: 'assistant',
        content: result.blocks.length ? result.blocks : [{ type: 'text', text: finalText || '(empty)' }],
      });

      const toolUses = result.blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');
      if (!toolUses.length) {
        if (result.stopReason === 'length') {
          session.info('输出达到 max_tokens 上限被截断，可在设置中调大。');
        }
        break;
      }

      const resultBlocks: ContentBlock[] = [];
      for (const tu of toolUses) {
        if (session.aborted) {
          resultBlocks.push({
            type: 'tool_result',
            toolUseId: tu.id,
            toolName: tu.name,
            content: [{ type: 'text', text: 'Cancelled by user.' }],
            isError: true,
          });
          continue;
        }
        const toolItemId = uid('t');
        const summary = summarizeArgs(tu.name, tu.input as Record<string, any>);
        session.upsert({ kind: 'tool', id: toolItemId, name: tu.name, summary, status: 'running' });

        const out = await executeToolUse(session, tu);

        const images = out.content.filter((c): c is ImageBlock => c.type === 'image');
        session.upsert({
          kind: 'tool',
          id: toolItemId,
          name: tu.name,
          summary,
          status: out.isError ? 'error' : 'ok',
          detail: truncate(textOfBlocks(out.content), 4000),
          images: images.length ? images.map((im) => `data:${im.mediaType};base64,${im.data}`) : undefined,
        });
        pruneTimelineImages(session, 6);

        resultBlocks.push({
          type: 'tool_result',
          toolUseId: tu.id,
          toolName: tu.name,
          content: out.content,
          isError: out.isError,
        });
      }
      session.messages.push({ role: 'user', content: resultBlocks });

      if (iter === adv.maxIterations - 1) {
        session.info(`已达到单轮最大迭代次数（${adv.maxIterations}）。回复「继续」可以接着执行。`);
      }
    }
    if (session.aborted) session.info('已停止。');
  } catch (e) {
    if (session.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
      session.info('已停止。');
    } else if (e instanceof DOMException && e.name === 'TimeoutError') {
      session.error(`请求超时（${Math.round(adv.requestTimeoutMs / 1000)}s）。可在设置中调整超时时间。`);
    } else {
      session.error(errText(e));
    }
  } finally {
    clearInterval(keepalive);
    session.running = false;
    session.controller = null;
    await session.persist();
    session.emit({ type: 'run_state', running: false });
  }
}

/**
 * 发给 API 前的历史整理（不改动原始历史）：
 * - 只保留最近 maxImages 张截图，更早的替换为占位文本
 * - 无视觉模型：移除全部图片
 */
function prepareForApi(messages: ChatMessage[], vision: boolean, maxImages: number): ChatMessage[] {
  const placeholder = vision
    ? '[older screenshot removed to save context — take a fresh one if needed]'
    : '[screenshot omitted: current model has no vision — use read_page / get_page_text instead]';
  let remaining = vision ? Math.max(0, maxImages) : 0;
  const clone: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content.map((b) =>
      b.type === 'tool_result' ? { ...b, content: b.content.map((c) => ({ ...c })) } : { ...b },
    ),
  }));
  for (let i = clone.length - 1; i >= 0; i--) {
    const content = clone[i].content;
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
  return clone;
}

/** 时间线里最多保留最近 keep 张截图（UI 内存控制） */
function pruneTimelineImages(session: Session, keep: number): void {
  let count = 0;
  for (let i = session.timeline.length - 1; i >= 0; i--) {
    const it = session.timeline[i];
    if (it.kind === 'tool' && it.images) {
      for (let j = it.images.length - 1; j >= 0; j--) {
        if (it.images[j]) {
          count++;
          if (count > keep) it.images[j] = null;
        }
      }
    }
  }
}

function summarizeArgs(name: string, input: Record<string, any>): string {
  const inp = input ?? {};
  switch (name) {
    case 'computer': {
      const loc = inp.ref
        ? `ref=${inp.ref}`
        : Array.isArray(inp.coordinate)
          ? `(${inp.coordinate.join(',')})`
          : '';
      const txt = inp.text ? ` "${truncate(String(inp.text), 30, '…')}"` : '';
      return `${inp.action ?? '?'} ${loc}${txt}`.trim();
    }
    case 'navigate':
      return String(inp.url ?? inp.action ?? '');
    case 'find':
      return `"${inp.query ?? ''}"`;
    case 'form_input':
      return `${inp.ref} = "${truncate(String(inp.value ?? ''), 30, '…')}"`;
    case 'scroll_to_ref':
      return String(inp.ref ?? '');
    case 'tabs_create':
      return String(inp.url ?? 'about:blank');
    case 'tabs_close':
      return `tab ${inp.tab_id}`;
    case 'javascript_tool':
      return truncate(String(inp.code ?? '').replace(/\s+/g, ' '), 48, '…');
    case 'file_upload':
      return String(inp.filename ?? inp.url ?? '');
    case 'gif_creator':
      return String(inp.filename ?? '');
    default: {
      const rest = { ...inp };
      delete rest.tab_id;
      const s = JSON.stringify(rest);
      return s === '{}' ? (inp.tab_id != null ? `tab ${inp.tab_id}` : '') : truncate(s, 60, '…');
    }
  }
}
