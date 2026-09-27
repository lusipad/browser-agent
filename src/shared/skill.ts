// ============================================================
// 技能 (SKILL)：可复用的语义化浏览器操作工作流
// ============================================================

/** 技能变量定义 */
export interface SkillVariable {
  /** 变量名（英文标识符，用于 {{name}} 模板替换） */
  name: string;
  /** 显示标签（用户可见） */
  label: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
  /** 输入框占位提示 */
  placeholder?: string;
  /** 下拉候选选项（配置时在运行界面呈现为 select 下拉框） */
  options?: string[];
}

/** 技能步骤（语义化意图，而非 DOM 选择器） */
export interface SkillStep {
  /** 自然语言描述，如 "在搜索框中输入{{keyword}}" */
  intent: string;
  /** 可选：导航目标 URL（可含 {{变量}} 占位符） */
  url?: string;
  /** 备注或条件说明 */
  note?: string;
}

/** 技能定时调度配置 */
export interface SkillSchedule {
  /** 是否启用定时调度 */
  enabled: boolean;
  /** 执行频次：15分钟、30分钟、1小时、6小时、12小时、24小时、每天固定时间 */
  frequency: '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | 'daily';
  /** 每天固定时间点，如 "09:30"（仅在 frequency === 'daily' 时有效） */
  dailyTime?: string;
  /** 任务执行完毕后是否推送 Chrome 桌面系统通知 */
  notifyOnComplete?: boolean;
  /** 上次运行时间戳 */
  lastRunAt?: number;
  /** 上次运行状态 */
  lastStatus?: 'success' | 'fail' | 'running';
  /** 上次运行失败原因（若有） */
  lastError?: string;
}

/** 完整技能定义 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** emoji 图标 */
  icon: string;
  version: number;
  variables: SkillVariable[];
  steps: SkillStep[];
  /** 定时运行配置 */
  schedule?: SkillSchedule;
  /** 来源对话 ID（用于溯源） */
  sourceConvId?: string;
  /** 是否置顶收藏 */
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 技能列表项（轻量元数据，不含步骤体） */
export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  variableCount: number;
  stepCount: number;
  /** 是否配置并启用了定时运行 */
  scheduled?: boolean;
  /** 是否置顶收藏 */
  pinned?: boolean;
  updatedAt: number;
}

/** 从完整 Skill 导出 SkillMeta */
export function toSkillMeta(s: Skill): SkillMeta {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
    variableCount: s.variables.length,
    stepCount: s.steps.length,
    scheduled: !!s.schedule?.enabled,
    pinned: !!s.pinned,
    updatedAt: s.updatedAt,
  };
}

/** 将技能步骤中的 {{变量}} 模板替换为实际值（支持变量默认值回退、系统魔法变量动态解析与未提供时的自主推导标记） */
export function resolveSkillTemplate(
  template: string,
  variables: Record<string, string | number | boolean>,
  variableDefs?: SkillVariable[],
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const v = variables[name];
    if (v !== undefined && v !== null && v !== '') {
      return String(v);
    }
    // 检查是否有预设默认值
    const def = variableDefs?.find((d) => d.name === name);
    if (def?.default !== undefined && def.default !== null && def.default !== '') {
      return String(def.default);
    }
    // 魔法系统动态变量回退（若调用方未显式传入且无默认值）
    const lowerName = name.toLowerCase();
    if (lowerName === 'today') {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (lowerName === 'now') {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    // 若均未提供，生成显式的自主推导指示标记，避免被替换为空字符串导致语义破损
    if (def) {
      return `[自主推导: ${def.label || def.name}]`;
    }
    return match;
  });
}

/** 解析技能步骤，替换所有变量模板（传入 variableDefs 保障智能推导与默认值生效） */
export function resolveSkillSteps(
  skill: Skill,
  variables: Record<string, string | number | boolean>,
): SkillStep[] {
  return skill.steps.map((step) => ({
    intent: resolveSkillTemplate(step.intent, variables, skill.variables),
    url: step.url ? resolveSkillTemplate(step.url, variables, skill.variables) : undefined,
    note: step.note ? resolveSkillTemplate(step.note, variables, skill.variables) : undefined,
  }));
}

/** 验证并标准化导入的技能数据（兼容单个对象或数组） */
export function parseImportedSkills(raw: unknown): Skill[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const now = Date.now();
  const valid: Skill[] = [];

  for (const item of list) {
    if (item && typeof item === 'object' && typeof (item as any).name === 'string' && (item as any).name.trim()) {
      const obj = item as Record<string, any>;
      const variables: SkillVariable[] = Array.isArray(obj.variables)
        ? obj.variables.map((v: any) => ({
            name: String(v.name ?? ''),
            label: String(v.label ?? v.name ?? ''),
            type: v.type === 'number' ? 'number' : v.type === 'boolean' ? 'boolean' : 'string',
            required: v.required !== false,
            default: v.default,
            placeholder: v.placeholder,
            options: Array.isArray(v.options) ? v.options.map(String).filter(Boolean) : undefined,
          }))
        : [];

      const steps: SkillStep[] = Array.isArray(obj.steps)
        ? obj.steps.map((s: any) => ({
            intent: String(s.intent ?? ''),
            url: s.url ? String(s.url) : undefined,
            note: s.note ? String(s.note) : undefined,
          }))
        : [];

      let schedule: SkillSchedule | undefined = undefined;
      if (obj.schedule && typeof obj.schedule === 'object') {
        const sched = obj.schedule as Record<string, any>;
        schedule = {
          enabled: !!sched.enabled,
          frequency: ['15m', '30m', '1h', '6h', '12h', '24h', 'daily'].includes(sched.frequency)
            ? sched.frequency
            : '1h',
          dailyTime: typeof sched.dailyTime === 'string' ? sched.dailyTime : '09:00',
          notifyOnComplete: sched.notifyOnComplete !== false,
          lastRunAt: typeof sched.lastRunAt === 'number' ? sched.lastRunAt : undefined,
          lastStatus: ['success', 'fail', 'running'].includes(sched.lastStatus) ? sched.lastStatus : undefined,
          lastError: typeof sched.lastError === 'string' ? sched.lastError : undefined,
        };
      }

      valid.push({
        id: typeof obj.id === 'string' && obj.id ? obj.id : 'skill_' + Math.random().toString(36).slice(2, 10),
        name: String(obj.name).trim(),
        description: String(obj.description ?? ''),
        icon: String(obj.icon ?? '⚡'),
        version: Number(obj.version ?? 1),
        variables,
        steps,
        schedule,
        pinned: !!obj.pinned,
        createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
        updatedAt: now,
      });
    }
  }

  return valid;
}

/** 官方精选预置技能（开箱即用模板） */
export const BUILTIN_PRESET_SKILLS: Skill[] = [
  {
    id: 'preset_page_summary',
    name: '网页深度精读与核心要点总结',
    description: '自动提取当前网页正文，提炼核心结论、论据与行动建议',
    icon: '📄',
    version: 1,
    pinned: true,
    variables: [
      {
        name: 'focus',
        label: '关注重点',
        type: 'string',
        required: false,
        default: '综合要点与行动项',
        options: ['综合要点与行动项', '核心商业模式与数据', '技术实现与关键架构', '潜在风险与争议点'],
      },
    ],
    steps: [
      {
        intent: '阅读并分析当前活动网页的正文内容',
      },
      {
        intent: '提取文章主旨并围绕重点「{{focus}}」进行深度梳理，输出 100 字核心结论、3~5 条关键要点清单，以及后续行动建议 (Action Items)',
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'preset_table_extract',
    name: '当前页面表格与列表数据提取',
    description: '智能穿透当前页面的表格、列表等结构化数据，清洗并整理为规范格式',
    icon: '📊',
    version: 1,
    pinned: true,
    variables: [
      {
        name: 'output_format',
        label: '输出数据格式',
        type: 'string',
        required: false,
        default: 'Markdown表格',
        options: ['Markdown表格', 'CSV格式', 'JSON数组'],
      },
      {
        name: 'filter_condition',
        label: '筛选条件说明',
        type: 'string',
        required: false,
        placeholder: '如“仅保留价格大于100的项”或留空提取全部',
      },
    ],
    steps: [
      {
        intent: '调用 extract 工具扫描当前页面中的数据表格或列表结构',
      },
      {
        intent: '根据筛选条件「{{filter_condition}}」清洗数据表头与行，并以 {{output_format}} 格式整齐输出',
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'preset_github_trending',
    name: 'GitHub 热门趋势速览与对比',
    description: '检索 GitHub Trending 热门开源仓库，快速生成技术特色与 Star 增速对比简报',
    icon: '🐙',
    version: 1,
    pinned: false,
    variables: [
      {
        name: 'keyword',
        label: '技术主题/关键字',
        type: 'string',
        required: false,
        default: 'AI Agent',
        placeholder: '如 AI Agent, Rust, WebAssembly 等',
      },
      {
        name: 'time_range',
        label: '趋势时间跨度',
        type: 'string',
        required: false,
        default: '今日热门 (daily)',
        options: ['今日热门 (daily)', '本周热门 (weekly)', '本月热门 (monthly)'],
      },
    ],
    steps: [
      {
        intent: '导航到 GitHub Trending 页面，查找与 {{keyword}} 相关的 {{time_range}} 开源项目',
        url: 'https://github.com/trending',
      },
      {
        intent: '提取排名前 3 的热门仓库信息（包含 Star 增长量、项目定位、技术特色及应用场景），生成结构化对比简报',
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'preset_game_2048',
    name: '2048 智能通关挑战',
    description: '在权威 2048 游戏网站运用角落堆叠策略（Corner Strategy）进行连续走子与高分冲击',
    icon: '🎮',
    version: 1,
    pinned: true,
    variables: [
      {
        name: 'strategy',
        label: '运筹策略',
        type: 'string',
        required: false,
        default: '右下角堆叠策略 (Corner Strategy: 优先下与右，次选左，避免上)',
        options: [
          '右下角堆叠策略 (Corner Strategy: 优先下与右，次选左，避免上)',
          '左下角堆叠策略 (Corner Strategy: 优先下与左，次选右，避免上)',
        ],
      },
    ],
    steps: [
      {
        intent: '若当前页面未在 2048 游戏页面，则导航到 https://2048game.com/',
        url: 'https://2048game.com/',
      },
      {
        intent: '观察 4x4 棋盘上的数字方块分布，按照「{{strategy}}」调用键盘事件（down/right/left）连续进行最优合并，保持最大数字锁定在角落，持续推进并汇报当前最高方块与得分',
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'preset_game_minesweeper',
    name: '扫雷地狱全自动排雷挑战',
    description: '在权威扫雷网站运用多阶命题逻辑与子集约束推演，全自动精准排查所有地雷并安全通关',
    icon: '💣',
    version: 1,
    pinned: true,
    variables: [
      {
        name: 'difficulty',
        label: '难度模式',
        type: 'string',
        required: false,
        default: '初级 (Beginner)',
        options: ['初级 (Beginner)', '中级 (Intermediate)', '专家 (Expert)'],
      },
    ],
    steps: [
      {
        intent: '导航至权威扫雷官方网站 https://minesweeperonline.com/',
        url: 'https://minesweeperonline.com/',
      },
      {
        intent: '扫描全网格数字与未翻开状态，运行多阶约束逻辑推演（CSP），精准识别地雷并插旗，毫秒级快速揭开所有安全格子，直至达成胜利 (facewin)',
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

