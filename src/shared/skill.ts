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
    updatedAt: s.updatedAt,
  };
}

/** 将技能步骤中的 {{变量}} 模板替换为实际值（支持变量默认值回退与未提供时的自主推导标记） */
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
        createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
        updatedAt: now,
      });
    }
  }

  return valid;
}

