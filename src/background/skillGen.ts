// 技能生成：从对话轨迹中提取 tool_use 序列，调用 LLM 生成语义化 SKILL 定义
import { openaiStream } from '../providers';
import type { Skill, SkillStep, SkillVariable } from '../shared/skill';
import type { ChatMessage, TextBlock, ToolUseBlock, ToolResultBlock } from '../shared/types';
import { textOfBlocks, truncate, uid } from '../shared/util';
import type { Session } from './session';
import { resolveModelBinding } from '../shared/models';
import { isBindingEnabled } from '../shared/models';

/** 从对话消息中提取轨迹摘要（工具名 + 参数 + 结果概要） */
export function extractTrajectory(messages: ChatMessage[]): string {
  const lines: string[] = [];
  let step = 0;
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === 'text' && m.role === 'user' && step === 0) {
        lines.push(`User task: ${truncate(b.text, 200, '…')}`);
      }
      if (b.type === 'tool_use') {
        step++;
        const tu = b as ToolUseBlock;
        const argsSummary = truncate(JSON.stringify(tu.input), 200, '…');
        lines.push(`Step ${step}: ${tu.name}(${argsSummary})`);
      }
      if (b.type === 'tool_result') {
        const tr = b as ToolResultBlock;
        const texts = tr.content
          .filter((c): c is TextBlock => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
        if (texts) lines.push(`  → ${truncate(texts, 150, '…')}`);
        if (tr.isError) lines.push(`  → ERROR`);
      }
    }
  }
  return lines.join('\n');
}

const SKILL_GEN_PROMPT = `You are a workflow extraction engine. Given a recorded browser agent trajectory (sequence of tool calls and results), produce a reusable SKILL definition in JSON.

Rules:
1. Each step must describe INTENT in natural language (e.g. "Search for {{keyword}} in the search box"), NOT DOM selectors or ref numbers.
2. Replace specific values (URLs, search terms, form content, filenames) with {{variable_name}} template placeholders.
3. Define each variable with name, label, type, required, and optionally default/placeholder.
4. Merge repeated operations (like pagination) into a single step with a note like "repeat until page {{max_pages}}".
5. Keep steps concise — typically 3–8 steps for most tasks.
6. Choose an appropriate emoji icon for the skill.
7. Output ONLY valid JSON matching this schema, no prose:

{
  "name": "string",
  "description": "string",
  "icon": "emoji",
  "variables": [{ "name": "string", "label": "string", "type": "string|number|boolean", "required": true, "default": "optional", "placeholder": "optional" }],
  "steps": [{ "intent": "string", "url": "optional string", "note": "optional string" }]
}`;

/** 调用 LLM 从对话轨迹中生成 SKILL 定义 */
export async function generateSkill(session: Session): Promise<Skill> {
  const trajectory = extractTrajectory(session.messages);
  if (!trajectory.includes('Step ')) {
    throw new Error('No tool calls found in conversation');
  }

  const binding = session.cfg.bindings.find((b) => b.id === session.bindingId);
  const resolved = binding ? resolveModelBinding(session.cfg, binding.id) : null;
  if (!resolved || !isBindingEnabled(binding!)) {
    throw new Error('No active model binding');
  }

  const { provider, model } = resolved;
  const messages: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: `Trajectory:\n${trajectory}` }] },
  ];

  const result = await openaiStream({
    provider,
    model,
    binding: binding!,
    system: SKILL_GEN_PROMPT,
    messages,
    tools: [],
    temperature: 0.2,
    maxTokens: 2048,
    signal: AbortSignal.timeout(60000),
    timeoutMs: 60000,
    retries: 1,
    onText: () => {},
  });

  const text = textOfBlocks(result.blocks).trim();
  return parseSkillJson(text, session.conversationId);
}

/** 解析 LLM 返回的 JSON，构造完整 Skill 对象 */
export function parseSkillJson(text: string, sourceConvId?: string): Skill {
  // 提取 JSON（可能被 ```json ... ``` 包裹）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in LLM response');

  const raw = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
  const now = Date.now();

  const variables: SkillVariable[] = (raw.variables ?? []).map((v: any) => ({
    name: String(v.name ?? ''),
    label: String(v.label ?? v.name ?? ''),
    type: v.type === 'number' ? 'number' : v.type === 'boolean' ? 'boolean' : 'string',
    required: v.required !== false,
    default: v.default,
    placeholder: v.placeholder,
  }));

  const steps: SkillStep[] = (raw.steps ?? []).map((s: any) => ({
    intent: String(s.intent ?? ''),
    url: s.url || undefined,
    note: s.note || undefined,
  }));

  return {
    id: uid('skill'),
    name: String(raw.name ?? 'Untitled Skill'),
    description: String(raw.description ?? ''),
    icon: String(raw.icon ?? '🔧'),
    version: 1,
    variables,
    steps,
    sourceConvId,
    createdAt: now,
    updatedAt: now,
  };
}
