import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_PRESET_SKILLS,
  parseImportedSkills,
  resolveSkillSteps,
  resolveSkillTemplate,
  toSkillMeta,
  type Skill,
} from '../../src/shared/skill';
import {
  deleteSkill,
  installPresetSkills,
  listSkills,
  loadAllSkills,
  loadSkill,
  saveSkill,
  togglePinSkill,
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

test('skill: resolveSkillSteps 未输入时回退默认值，无默认值时标记自主推导', () => {
  const s: Skill = {
    id: 's_infer',
    name: '比价技能',
    description: '测试推导',
    icon: '⚡',
    version: 1,
    variables: [
      { name: 'keyword', label: '搜索词', type: 'string', required: false, default: '机械键盘' },
      { name: 'price_limit', label: '价格上限', type: 'number', required: false },
    ],
    steps: [
      { intent: '在搜索框中输入 {{keyword}} 并搜索' },
      { intent: '筛选价格低于 {{price_limit}} 元的商品' },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  // 1. 用户留空输入 {}：keyword 自动回退默认值 '机械键盘'，price_limit 替换为 [自主推导: 价格上限]
  const resolved = resolveSkillSteps(s, {});
  assert.equal(resolved[0].intent, '在搜索框中输入 机械键盘 并搜索');
  assert.equal(resolved[1].intent, '筛选价格低于 [自主推导: 价格上限] 元的商品');

  // 2. 用户显式输入覆盖默认值
  const resolvedCustom = resolveSkillSteps(s, { keyword: '显卡', price_limit: 3000 });
  assert.equal(resolvedCustom[0].intent, '在搜索框中输入 显卡 并搜索');
  assert.equal(resolvedCustom[1].intent, '筛选价格低于 3000 元的商品');
});

test('skill: parseSkillJson 支持提取默认值并默认为非必填', () => {
  const jsonWithDefaults = `\`\`\`json
{
  "name": "商品比价",
  "description": "自动比价",
  "icon": "🛒",
  "variables": [
    { "name": "prod", "label": "商品名称", "type": "string", "default": "4K显示器", "placeholder": "输入商品名", "required": true },
    { "name": "sort", "label": "排序方式", "type": "string", "required": true }
  ],
  "steps": [{ "intent": "搜索 {{prod}}" }]
}
\`\`\``;

  const parsed = parseSkillJson(jsonWithDefaults);
  assert.equal(parsed.variables[0].default, '4K显示器');
  assert.equal(parsed.variables[0].required, false); // 强制覆盖为非必填，支持留空自主分析
  assert.equal(parsed.variables[1].required, false);
  assert.ok(parsed.variables[1].placeholder.includes('自主推导'));
});

test('skill: 编辑技能并保存验证', async () => {
  installMemStorage();
  const original = makeSkill('edit-test-1', '原始技能', 1000);
  await saveSkill(original);

  const loaded = await loadSkill('edit-test-1');
  assert.ok(loaded);
  assert.equal(loaded.name, '原始技能');

  // 模拟用户在 SkillDrawer 或设置页中的编辑操作
  const modified: Skill = {
    ...loaded,
    name: '修改后的技能名称',
    icon: '🚀',
    description: '新描述',
    steps: [
      { intent: '第一步修改后的操作 {{keyword}}' },
      { intent: '新增的第二步操作' },
    ],
    variables: [
      { name: 'keyword', label: '自定义搜索词', type: 'string', required: false, default: 'MacBook' },
    ],
    updatedAt: 2000,
  };
  await saveSkill(modified);

  const updated = await loadSkill('edit-test-1');
  assert.ok(updated);
  assert.equal(updated.name, '修改后的技能名称');
  assert.equal(updated.icon, '🚀');
  assert.equal(updated.description, '新描述');
  assert.equal(updated.steps.length, 2);
  assert.equal(updated.steps[0].intent, '第一步修改后的操作 {{keyword}}');
  assert.equal(updated.variables.length, 1);
  assert.equal(updated.variables[0].default, 'MacBook');
});

test('skill: resolveSkillTemplate 魔法动态变量 {{today}} 和 {{now}} 自动解析', () => {
  const tpl = '执行任务：今天日期 {{today}}，当前时间 {{now}}';
  const res = resolveSkillTemplate(tpl, {});
  assert.match(res, /今天日期 \d{4}-\d{2}-\d{2}，当前时间 \d{2}:\d{2}/);

  // 显式输入应覆盖动态魔法变量
  const resOverride = resolveSkillTemplate(tpl, { today: '2026-01-01', now: '12:00' });
  assert.equal(resOverride, '执行任务：今天日期 2026-01-01，当前时间 12:00');
});

test('skill: parseImportedSkills 支持 options 枚举选项与 pinned 置顶', () => {
  const raw = {
    name: '选项技能',
    pinned: true,
    variables: [
      { name: 'sort', label: '排序', type: 'string', options: ['综合', '销量', '价格'] },
    ],
    steps: [{ intent: '按 {{sort}} 排序' }],
  };
  const parsed = parseImportedSkills(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].pinned, true);
  assert.deepEqual(parsed[0].variables[0].options, ['综合', '销量', '价格']);
});

test('skill: 置顶技能优先级排序与 togglePinSkill', async () => {
  installMemStorage();
  const s1 = makeSkill('s1', '普通技能最新', 3000);
  const s2 = makeSkill('s2', '置顶技能较旧', 1000);
  s2.pinned = true;
  const s3 = makeSkill('s3', '普通技能居中', 2000);

  await saveSkill(s1);
  await saveSkill(s2);
  await saveSkill(s3);

  const list = await listSkills();
  assert.equal(list.length, 3);
  // 置顶的 s2 无论更新时间如何，始终排在首位
  assert.equal(list[0].id, 's2');
  assert.equal(list[0].pinned, true);
  assert.equal(list[1].id, 's1');
  assert.equal(list[2].id, 's3');

  // 取消置顶 s2
  const isPinnedAfter = await togglePinSkill('s2');
  assert.equal(isPinnedAfter, false);
  const listAfterUnpin = await listSkills();
  assert.equal(listAfterUnpin[0].pinned, false);
});

test('skill: 官方预置技能模板载入 installPresetSkills', async () => {
  installMemStorage();
  assert.ok(BUILTIN_PRESET_SKILLS.length >= 3);
  const count = await installPresetSkills();
  assert.equal(count, BUILTIN_PRESET_SKILLS.length);

  const all = await listSkills();
  assert.equal(all.length, BUILTIN_PRESET_SKILLS.length);

  // 重复载入不产生冗余技能
  const repeatedCount = await installPresetSkills();
  assert.equal(repeatedCount, 0);
  assert.equal((await listSkills()).length, BUILTIN_PRESET_SKILLS.length);
});

test('skill: 技能关键词搜索与分类筛选过滤算法', () => {
  const isPreset = (id: string) => id.startsWith('builtin-preset-');
  const sampleSkills = [
    { id: 'builtin-preset-article-summary', name: '网页深度精读与核心要点总结', description: '自动提取当前网页正文', pinned: true },
    { id: 'builtin-preset-table-extract', name: '当前页面表格与列表数据提取', description: '智能穿透当前页面的表格', pinned: true },
    { id: 'custom-skill-1', name: '竞品硬件定价自动折算助手', description: '按参考汇率换算价格', pinned: false },
    { id: 'custom-skill-2', name: 'GitHub 趋势追踪', description: '检索最新开源热度', pinned: false },
  ];

  // 1. 全部搜索 "表格"
  const searchTable = sampleSkills.filter((s) => s.name.includes('表格') || s.description.includes('表格'));
  assert.equal(searchTable.length, 1);
  assert.equal(searchTable[0].id, 'builtin-preset-table-extract');

  // 2. 搜索 "汇率" (仅在描述中)
  const searchRate = sampleSkills.filter((s) => s.name.includes('汇率') || s.description.includes('汇率'));
  assert.equal(searchRate.length, 1);
  assert.equal(searchRate[0].id, 'custom-skill-1');

  // 3. 置顶过滤 (pinned)
  const pinnedOnly = sampleSkills.filter((s) => s.pinned);
  assert.equal(pinnedOnly.length, 2);

  // 4. 官方模板过滤 (preset)
  const presetsOnly = sampleSkills.filter((s) => isPreset(s.id));
  assert.equal(presetsOnly.length, 2);

  // 5. 自定义技能过滤 (custom)
  const customOnly = sampleSkills.filter((s) => !isPreset(s.id));
  assert.equal(customOnly.length, 2);
});

test('skill: Markdown 表格提取与 CSV 规范格式转换', () => {
  const assistantReply = `### 分析报告\n\n` +
    `以下是提取的设备行情数据：\n\n` +
    `| 设备名称 | 厂商 | 指导价 (含税) | 推荐度 |\n` +
    `| :--- | :--- | :--- | :--- |\n` +
    `| Meta Quest 4 | Meta, Inc. | $499 "标准版" | ★★★★★ |\n` +
    `| Apple Vision Air | Apple | $1,299 | ★★★★☆ |\n\n` +
    `数据清洗完毕。`;

  // 提取 Markdown 表格行
  const lines = assistantReply.split('\n');
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable) {
      break;
    }
  }

  assert.equal(tableLines.length, 4); // 表头 + 分隔线 + 2数据行

  // 转换为 CSV 行
  const csvRows: string[] = [];
  for (let i = 0; i < tableLines.length; i++) {
    if (i === 1 && /\|[ \t]*[-:]+/.test(tableLines[i])) continue;
    const rawCells = tableLines[i].split('|').slice(1, -1);
    const row = rawCells.map((c) => {
      const cell = c.trim().replace(/"/g, '""');
      return `"${cell}"`;
    }).join(',');
    csvRows.push(row);
  }

  assert.equal(csvRows.length, 3); // 表头 + 2数据行
  assert.equal(csvRows[0], '"设备名称","厂商","指导价 (含税)","推荐度"');
  // 逗号与引号正确转义
  assert.equal(csvRows[1], '"Meta Quest 4","Meta, Inc.","$499 ""标准版""","★★★★★"');
  assert.equal(csvRows[2], '"Apple Vision Air","Apple","$1,299","★★★★☆"');
});




