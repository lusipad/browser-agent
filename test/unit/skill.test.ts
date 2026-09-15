import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseImportedSkills,
  resolveSkillSteps,
  resolveSkillTemplate,
  toSkillMeta,
  type Skill,
} from '../../src/shared/skill';
import {
  deleteSkill,
  listSkills,
  loadAllSkills,
  loadSkill,
  saveSkill,
} from '../../src/shared/skillsStore';
import { extractTrajectory, parseSkillJson } from '../../src/background/skillGen';
import type { ChatMessage } from '../../src/shared/types';

function installMemStorage() {
  const store = new Map<string, unknown>();
  (globalThis as any).chrome.storage.local = {
    get: async (key: string | string[]) => {
      const res: Record<string, unknown> = {};
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) {
        if (store.has(k)) res[k] = store.get(k);
      }
      return res;
    },
    set: async (obj: Record<string, unknown>) => {
      for (const k of Object.keys(obj)) store.set(k, obj[k]);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
  };
  return store;
}

function makeSkill(id: string, name: string, updatedAt: number): Skill {
  return {
    id,
    name,
    description: `Desc ${name}`,
    icon: '⚡',
    version: 1,
    variables: [
      { name: 'keyword', label: '关键词', type: 'string', required: true, default: 'test' },
      { name: 'count', label: '数量', type: 'number', required: false, default: 5 },
    ],
    steps: [
      { intent: '搜索 {{keyword}}', url: 'https://example.com?q={{keyword}}' },
      { intent: '获取前 {{count}} 项结果' },
    ],
    createdAt: updatedAt,
    updatedAt,
  };
}

test('skill: resolveSkillTemplate 模板替换变量', () => {
  const tpl = '在 {{site}} 搜索 {{keyword}} 并翻 {{pages}} 页';
  const res = resolveSkillTemplate(tpl, { site: 'GitHub', keyword: 'agent' });
  assert.equal(res, '在 GitHub 搜索 agent 并翻 {{pages}} 页');
});

test('skill: resolveSkillSteps 解析全部步骤的变量', () => {
  const s = makeSkill('s1', '测试技能', 1000);
  const resolved = resolveSkillSteps(s, { keyword: 'DeepSeek', count: 10 });
  assert.equal(resolved[0].intent, '搜索 DeepSeek');
  assert.equal(resolved[0].url, 'https://example.com?q=DeepSeek');
  assert.equal(resolved[1].intent, '获取前 10 项结果');
});

test('skill: toSkillMeta 提取轻量元数据', () => {
  const s = makeSkill('s1', '测试技能', 1234);
  const meta = toSkillMeta(s);
  assert.equal(meta.id, 's1');
  assert.equal(meta.name, '测试技能');
  assert.equal(meta.variableCount, 2);
  assert.equal(meta.stepCount, 2);
  assert.equal(meta.updatedAt, 1234);
});

test('skill: 存储 CRUD - 保存、列表、读取、全部加载、删除', async () => {
  installMemStorage();
  await saveSkill(makeSkill('sk1', '技能一', 1000));
  await saveSkill(makeSkill('sk2', '技能二', 3000));
  await saveSkill(makeSkill('sk3', '技能三', 2000));

  const list = await listSkills();
  assert.equal(list.length, 3);
  // 按 updatedAt 降序
  assert.deepEqual(
    list.map((x) => x.id),
    ['sk2', 'sk3', 'sk1'],
  );

  const loaded = await loadSkill('sk2');
  assert.ok(loaded);
  assert.equal(loaded!.name, '技能二');
  assert.equal(loaded!.steps.length, 2);

  const all = await loadAllSkills();
  assert.equal(all.length, 3);
  assert.equal(all[0].id, 'sk2');

  await deleteSkill('sk2');
  assert.equal((await listSkills()).length, 2);
  assert.equal(await loadSkill('sk2'), null);
});

test('skill: extractTrajectory 提取轨迹摘要', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: '去京东搜索机械键盘' }] },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'navigate',
          input: { url: 'https://www.jd.com' },
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'tu1',
          toolName: 'navigate',
          content: [{ type: 'text', text: 'Navigated to https://www.jd.com' }],
        },
      ],
    },
  ];

  const traj = extractTrajectory(msgs);
  assert.ok(traj.includes('User task: 去京东搜索机械键盘'));
  assert.ok(traj.includes('Step 1: navigate'));
  assert.ok(traj.includes('Navigated to https://www.jd.com'));
});

test('skill: parseSkillJson 解析 LLM 生成的 JSON', () => {
  const rawJson = `\`\`\`json
{
  "name": "京东搜索",
  "description": "在京东搜索指定商品",
  "icon": "🛒",
  "variables": [
    { "name": "keyword", "label": "商品名称", "type": "string", "required": true }
  ],
  "steps": [
    { "intent": "导航到京东", "url": "https://www.jd.com" },
    { "intent": "输入 {{keyword}} 并回车" }
  ]
}
\`\`\``;

  const parsed = parseSkillJson(rawJson, 'conv_123');
  assert.equal(parsed.name, '京东搜索');
  assert.equal(parsed.icon, '🛒');
  assert.equal(parsed.variables.length, 1);
  assert.equal(parsed.variables[0].name, 'keyword');
  assert.equal(parsed.steps.length, 2);
  assert.equal(parsed.sourceConvId, 'conv_123');
  assert.ok(parsed.id.startsWith('skill_'));
});

test('skill: parseImportedSkills 导入验证与格式规范化', () => {
  // 1. 支持单个对象导入
  const single = {
    name: 'GitHub Star 查询',
    description: '查询 repo 的 star 数',
    icon: '⭐',
    variables: [{ name: 'repo', label: '仓库', type: 'string' }],
    steps: [{ intent: '打开 https://github.com/{{repo}}' }],
  };
  const res1 = parseImportedSkills(single);
  assert.equal(res1.length, 1);
  assert.equal(res1[0].name, 'GitHub Star 查询');
  assert.equal(res1[0].icon, '⭐');
  assert.equal(res1[0].variables.length, 1);
  assert.equal(res1[0].steps.length, 1);
  assert.ok(res1[0].id.startsWith('skill_'));

  // 2. 支持数组批量导入
  const batch = [
    { name: '技能 A', steps: [{ intent: 'A1' }] },
    { name: '技能 B', steps: [{ intent: 'B1' }] },
  ];
  const res2 = parseImportedSkills(batch);
  assert.equal(res2.length, 2);
  assert.equal(res2[0].name, '技能 A');
  assert.equal(res2[1].name, '技能 B');

  // 3. 容错：非法输入安全过滤
  assert.equal(parseImportedSkills(null).length, 0);
  assert.equal(parseImportedSkills({ invalid: 123 }).length, 0);
  assert.equal(parseImportedSkills([{}]).length, 0);
});

