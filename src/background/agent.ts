// 智能体主循环：Planner（规划）→ Navigator（模型流式输出→执行工具→迭代）→ Validator（自检）
import { openaiStream } from '../providers';
import { classifyProviderError } from '../providers/types';
import { buildSystemPrompt } from '../shared/prompts';
import { loadConfig } from '../shared/settings';
import type {
  ChatMessage,
  ContentBlock,
  ImageBlock,
  ModelBinding,
  ModelConfig,
  ProviderConfig,
  RegionSnippet,
  TextBlock,
  ToolUseBlock,
} from '../shared/types';
import { computeCost, governContext, inputBudgetFor } from '../shared/context';
import { errText, textOfBlocks, truncate, uid } from '../shared/util';
import { runInPage } from './inject';
import type { Session } from './session';
import { executeToolUse, shotBlocks, toolSpecs } from './tools/registry';
import { isBindingEnabled } from '../shared/models';

const VALIDATOR_CAP = 2;

export async function runTurn(
  session: Session,
  userText: string,
  opts?: { continuation?: boolean; region?: RegionSnippet },
): Promise<void> {
  const continuation = !!opts?.continuation;
  session.cfg = await loadConfig();

  if (!continuation) {
    const region = opts?.region;
    const userBlocks: ContentBlock[] = [];
    let promptText = userText.trim();
    if (region) {
      const regionPrefix = `[User focused/selected region at viewport coordinates (x: ${region.x}, y: ${region.y}, width: ${region.w}, height: ${region.h})${
        region.elementsSummary ? ` containing elements: ${region.elementsSummary}` : ''
      }]:\n`;
      promptText = regionPrefix + (promptText || 'Please analyze, extract, or interact with this selected region.');
      userBlocks.push({
        type: 'image',
        data: region.data,
        mediaType: region.mediaType,
      });
    }
    userBlocks.unshift({ type: 'text', text: promptText || userText });
    session.messages.push({ role: 'user', content: userBlocks });
    session.upsert({
      kind: 'user',
      id: uid('u'),
      text: userText.trim() || (region ? '🎯 选区操作与解析' : ''),
      image: region ? `data:${region.mediaType};base64,${region.data}` : undefined,
      regionInfo: region ? { w: region.w, h: region.h } : undefined,
    });
  }

  const binding = session.cfg.bindings.find((b) => b.id === session.bindingId);
  const model = binding && session.cfg.models.find((m) => m.id === binding.modelId);
  if (!binding || !model || !isBindingEnabled(binding)) {
    session.error(session.t('bg.noModel'));
    return;
  }
  const provider = session.cfg.providers.find((p) => p.id === binding.providerId);
  if (!provider) {
    session.error(session.t('bg.providerMissing', [model.label]));
    return;
  }
  if (!provider.apiKey.trim()) {
    session.error(session.t('bg.noApiKey', [provider.name]));
    return;
  }

  const adv = session.cfg.advanced;
  const firstTurn = !session.messages.some((m) => m.role === 'assistant');

  session.running = true;
  session.aborted = false;
  session.controller = new AbortController();
  session.emit({ type: 'run_state', running: true });
  const keepalive = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 15000);

  let sysBase = buildSystemPrompt({
    date: new Date().toISOString().slice(0, 10),
    vision: session.effectiveVision(),
    screenshotMaxWidth: adv.screenshotMaxWidth,
  });

  if (session.activeSkill) {
    const skill = session.activeSkill;
    const varsText = skill.resolvedVars
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    sysBase +=
      `\n\n## Active Skill: ${skill.name}\n` +
      `${skill.description}\n\n` +
      `### Parameters & Variables\n${varsText || '(None)'}\n\n` +
      `### Steps (follow this workflow plan, adapting to actual page state)\n` +
      skill.steps
        .map(
          (s, i) =>
            `${i + 1}. ${s.intent}${s.url ? ` (navigate to: ${s.url})` : ''}${s.note ? ` [Note: ${s.note}]` : ''}`,
        )
        .join('\n') +
      `\n\n### Execution Guidelines for Active Skill:\n` +
      `1. Follow these steps in order. Each step describes high-level INTENT, not exact DOM elements — use your tools to find the right elements on the current page.\n` +
      `2. **Auto-inference for unspecified parameters**: If any variable or step parameter is marked as [自主推导: ...] or (未指定) or left blank, DO NOT fail or stop. Autonomously analyze the current page content, URL, user context, or common sense to deduce the most sensible value and proceed decisively.\n` +
      `3. If a step cannot be completed as described, adapt intelligently or self-correct to fulfill the overall objective.`;
  }

  // 「继续」时沿用最初的任务作为成功判据
  let successCriteria = continuation ? firstUserText(session) || userText : userText;
  let validatorRounds = 0;

  try {
    // ---------- Planner ----------
    if (adv.planning && firstTurn && !continuation && !session.aborted) {
      const crit = await runPlanner(session, provider, model, binding, sysBase, userText);
      if (crit) successCriteria = crit;
    }

    // ---------- Navigator（含内联 Validator） ----------
    for (let iter = 0; iter < adv.maxIterations; iter++) {
      if (session.aborted) break;

      const asstId = uid('a');
      let streamed = '';
      session.upsert({ kind: 'assistant', id: asstId, text: '', done: false });

      const budget = inputBudgetFor(model.contextWindow, adv.maxTokens, adv.maxContextTokens);
      const governed = governContext(session.messages, {
        vision: session.effectiveVision(),
        maxImages: adv.maxImagesKept,
        maxInputTokens: budget,
      });

      const result = await streamOnce(session, provider, model, binding, sysBase, governed.messages, activeToolSpecs(session), (delta) => {
        streamed += delta;
        session.emit({ type: 'text_delta', id: asstId, delta });
      });

      accrueUsage(session, result.usage, binding.pricing);
      emitUsage(session, { tokens: governed.estInputTokens, budget });
      const finalText = textOfBlocks(result.blocks) || streamed;
      session.upsert({ kind: 'assistant', id: asstId, text: finalText, done: true });
      session.messages.push({
        role: 'assistant',
        content: result.blocks.length ? result.blocks : [{ type: 'text', text: finalText || '(empty)' }],
        reasoning_content: result.reasoningText || undefined,
      });

      const toolUses = result.blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');

      if (!toolUses.length) {
        if (!finalText.trim()) {
          session.error(session.t('bg.emptyResponse', [binding.apiModelName]));
          break;
        }
        // 模型认为完成 → Validator 自检
        if (adv.planning && validatorRounds < VALIDATOR_CAP && !session.aborted) {
          const verdict = await runValidator(session, provider, model, binding, sysBase, userText, successCriteria);
          if (!verdict.done) {
            validatorRounds++;
            session.upsert({
              kind: 'info',
              id: uid('i'),
              text: session.t('bg.validatorFail', [
                verdict.reason || session.t('bg.validatorFailReason'),
                verdict.next ? session.t('bg.validatorNext', [verdict.next]) : '',
              ]),
            });
            session.messages.push({
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    `A validator reviewed the current page state against the success criterion and judged the task NOT complete.\n` +
                    `Reason: ${verdict.reason}\n${verdict.next ? `Suggested next step: ${verdict.next}\n` : ''}` +
                    `Success criterion: ${successCriteria}\nKeep working with tools until it is met. Do not stop and claim completion prematurely.`,
                },
              ],
            });
            continue;
          }
          session.upsert({ kind: 'info', id: uid('i'), text: session.t('bg.validatorPass') });
        }
        if (result.stopReason === 'length') session.info(session.t('bg.maxTokens'));
        const hasTools = session.messages.some((m) => m.content.some((c) => c.type === 'tool_use'));
        if (hasTools && !session.activeSkill) {
          session.timeline = session.timeline.filter((it) => it.kind !== 'skill_prompt');
          session.upsert({ kind: 'skill_prompt', id: uid('sp'), action: 'save_skill' });
        }
        break;
      }

      // 执行工具
      const resultBlocks: ContentBlock[] = [];
      for (const tu of toolUses) {
        if (session.aborted) {
          resultBlocks.push({ type: 'tool_result', toolUseId: tu.id, toolName: tu.name, content: [{ type: 'text', text: 'Cancelled by user.' }], isError: true });
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

        resultBlocks.push({ type: 'tool_result', toolUseId: tu.id, toolName: tu.name, content: out.content, isError: out.isError });
      }
      session.messages.push({ role: 'user', content: resultBlocks });

      if (iter === adv.maxIterations - 1)
        session.upsert({
          kind: 'info',
          id: uid('i'),
          text: session.t('bg.maxIter', [adv.maxIterations]),
          action: 'continue',
        });
    }
    if (session.aborted) session.info(session.t('bg.stopped'));
  } catch (e) {
    if (session.aborted || (e instanceof DOMException && e.name === 'AbortError')) session.info(session.t('bg.stopped'));
    else if (e instanceof DOMException && e.name === 'TimeoutError') session.error(session.t('bg.timeout', [Math.round(adv.requestTimeoutMs / 1000)]));
    else session.error(classifyProviderError(e) || errText(e));
  } finally {
    clearInterval(keepalive);
    session.running = false;
    session.controller = null;
    await session.persist();
    session.emit({ type: 'run_state', running: false });
  }
}

function streamOnce(
  session: Session,
  provider: ProviderConfig,
  model: ModelConfig,
  binding: ModelBinding,
  system: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof toolSpecs>,
  onText: (d: string) => void,
) {
  const adv = session.cfg.advanced;
  return openaiStream({
    provider,
    model,
    binding,
    system,
    messages,
    tools,
    temperature: adv.temperature,
    maxTokens: adv.maxTokens,
    signal: session.controller!.signal,
    timeoutMs: adv.requestTimeoutMs,
    retries: adv.maxRetries,
    onText,
  });
}

function accrueUsage(
  session: Session,
  usage: { input: number; output: number } | undefined,
  pricing: ModelBinding['pricing'],
): void {
  if (!usage) return;
  session.usage.input += usage.input;
  session.usage.output += usage.output;
  const requestCost = computeCost(usage, pricing);
  if (session.usage.input === usage.input && session.usage.output === usage.output) {
    session.usage.cost = requestCost;
  } else if (session.usage.cost != null && requestCost != null) {
    session.usage.cost += requestCost;
  } else {
    session.usage.cost = null;
  }
}

/** 向面板推送按实际绑定累计的 token / 成本 / 上下文占用 */
function emitUsage(session: Session, context?: { tokens: number; budget: number }): void {
  session.emit({
    type: 'usage',
    input: session.usage.input,
    output: session.usage.output,
    cost: session.usage.cost,
    contextTokens: context?.tokens,
    contextBudget: context?.budget,
  });
}

/** Planner：把任务拆成清单并给出可观测的成功判据（不调用工具） */
async function runPlanner(
  session: Session,
  provider: ProviderConfig,
  model: ModelConfig,
  binding: ModelBinding,
  sysBase: string,
  task: string,
): Promise<string | null> {
  const sys =
    sysBase +
    '\n\n## Current role: PLANNER\n' +
    'Break the user request into a SHORT ordered checklist (max 6 steps) of browser actions. ' +
    'Then state one explicit SUCCESS CRITERION: how to verify, by observing the page, that the task is truly done. ' +
    'Do NOT call any tools now — just plan. Keep it concise. ' +
    'End your reply with a line in exactly this form: "SUCCESS: <criterion>".';
  const id = uid('a');
  session.upsert({ kind: 'assistant', id, text: '', done: false });
  let text = '';
  let reasoningText: string | undefined;
  try {
    const res = await streamOnce(session, provider, model, binding, sys, [{ role: 'user', content: [{ type: 'text', text: task }] }], [], (d) => {
      text += d;
      session.emit({ type: 'text_delta', id, delta: d });
    });
    reasoningText = res.reasoningText;
    accrueUsage(session, res.usage, binding.pricing);
    emitUsage(session);
    text = textOfBlocks(res.blocks) || text;
    if (!text.trim()) {
      session.upsert({
        kind: 'assistant',
        id,
        text: session.t('bg.planSkipped', [session.t('bg.emptyStageResponse', [binding.apiModelName])]),
        done: true,
      });
      return null;
    }
  } catch (e) {
    // 规划失败不致命：直接进入执行
    session.upsert({ kind: 'assistant', id, text: text || '', done: true });
    session.info(session.t('bg.planSkipped', [truncate(errText(e), 120)]));
    return null;
  }
  session.upsert({ kind: 'assistant', id, text: text || '(无计划输出)', done: true });
  // 计划也进入历史，让 navigator 看到自己的计划
  session.messages.push({ role: 'assistant', content: [{ type: 'text', text: text || '(plan)' }], reasoning_content: reasoningText || undefined });
  const m = text.match(/SUCCESS:\s*(.+)\s*$/im);
  return m ? m[1].trim() : null;
}

interface Verdict {
  done: boolean;
  reason: string;
  next: string;
}

/** Validator：对照成功判据判断当前页面状态是否达成（不调用工具） */
async function runValidator(
  session: Session,
  provider: ProviderConfig,
  model: ModelConfig,
  binding: ModelBinding,
  sysBase: string,
  task: string,
  criteria: string,
): Promise<Verdict> {
  try {
    const state = await currentStateBlocks(session);
    const sys =
      sysBase +
      '\n\n## Current role: VALIDATOR\n' +
      'Judge whether the task is COMPLETE based ONLY on the current page state provided. Be strict but fair. ' +
      'Reply with ONLY a JSON object, no prose: {"done": boolean, "reason": string, "next": string}. ' +
      '"next" = the single most useful next action if not done.';
    const user: Array<TextBlock | ImageBlock> = [
      { type: 'text', text: `Task: ${task}\nSuccess criterion: ${criteria}\n\nCurrent page state:` },
      ...state,
    ];
    const res = await streamOnce(session, provider, model, binding, sys, [{ role: 'user', content: user }], [], () => {});
    accrueUsage(session, res.usage, binding.pricing);
    emitUsage(session);
    const text = textOfBlocks(res.blocks).trim();
    if (!text) {
      session.info(session.t('bg.validateSkipped', [session.t('bg.emptyStageResponse', [binding.apiModelName])]));
      return { done: true, reason: '', next: '' };
    }
    return parseVerdict(text);
  } catch (e) {
    // 校验失败时不阻塞收尾，视为完成
    session.info(session.t('bg.validateSkipped', [truncate(errText(e), 120)]));
    return { done: true, reason: '', next: '' };
  }
}

async function currentStateBlocks(session: Session): Promise<Array<TextBlock | ImageBlock>> {
  const tabId = session.currentTabId;
  if (tabId == null) return [{ type: 'text', text: '(no active browser tab — judge from the conversation)' }];
  try {
    if (session.effectiveVision()) return await shotBlocks(session, tabId, 'validation');
    const r = await runInPage(tabId, 'read_page', { filter: 'interactive', max_chars: 6000 });
    return [{ type: 'text', text: String(r?.text ?? '(empty)') }];
  } catch (e) {
    return [{ type: 'text', text: `(could not read page: ${errText(e)})` }];
  }
}

function parseVerdict(text: string): Verdict {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      return { done: !!j.done, reason: String(j.reason ?? ''), next: String(j.next ?? '') };
    } catch {
      /* 落到启发式 */
    }
  }
  const negative = /\b(not\s+(done|complete)|incomplete|未完成|没有完成|尚未)\b/i.test(text);
  const positive = /\b(done|complete|success|完成|已完成|通过)\b/i.test(text);
  return { done: positive && !negative, reason: truncate(text.trim(), 200), next: '' };
}

/** 按会话配置过滤工具清单：javascript_tool 默认关闭时不暴露给模型 */
function activeToolSpecs(session: Session): ReturnType<typeof toolSpecs> {
  const specs = toolSpecs();
  if (session.cfg.advanced.enableJavascriptTool) return specs;
  return specs.filter((s) => s.name !== 'javascript_tool');
}

/** 取历史里最早的一条用户文本（作为「继续」时的成功判据） */
function firstUserText(session: Session): string {
  for (const m of session.messages) {
    if (m.role !== 'user') continue;
    const t = m.content.find((b): b is TextBlock => b.type === 'text');
    if (t) return t.text;
  }
  return '';
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
      const loc = inp.ref ? `ref=${inp.ref}` : Array.isArray(inp.coordinate) ? `(${inp.coordinate.join(',')})` : '';
      const txt = inp.text ? ` "${truncate(String(inp.text), 30, '…')}"` : '';
      return `${inp.action ?? '?'} ${loc}${txt}`.trim();
    }
    case 'navigate':
      return String(inp.url ?? inp.action ?? '');
    case 'find':
      return `"${inp.query ?? ''}"`;
    case 'extract_data':
      return inp.selector ? `${inp.mode ?? 'selector'} ${inp.selector}` : String(inp.mode ?? 'tables');
    case 'wait_for':
      return `${inp.condition ?? ''} ${inp.query ? `"${inp.query}"` : inp.text ? `"${truncate(String(inp.text), 24, '…')}"` : ''}`.trim();
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
