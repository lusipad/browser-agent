// 技能持久化存储：支持 chrome.storage.sync 跨设备云同步 + 本地离线镜像 + 配额保护
import type { Skill, SkillMeta } from './skill';
import { toSkillMeta } from './skill';
import { readSynced, removeSynced, writeSynced } from './syncStorage';

const INDEX_KEY = 'skill_index';
const skillKey = (id: string) => `skill:${id}`;
const MAX_SKILLS = 50;

/** 检查并清洗技能中的敏感字符串（如误将 API Key 或 Token 填为变量默认值） */
function sanitizeSkillSecrets(skill: Skill): Skill {
  const sanitizedVars = skill.variables.map((v) => {
    let def = v.default;
    if (typeof def === 'string' && /^(sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{30,})/i.test(def.trim())) {
      def = '';
    }
    return { ...v, default: def };
  });
  return { ...skill, variables: sanitizedVars };
}

export async function listSkills(): Promise<SkillMeta[]> {
  try {
    const idx = await readSynced<SkillMeta[]>(INDEX_KEY);
    return Array.isArray(idx) ? idx.slice().sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

async function writeIndex(list: SkillMeta[]): Promise<void> {
  await writeSynced(INDEX_KEY, list);
}

/** 保存 / 更新一个技能（优先同步上云，同时本地留存镜像） */
export async function saveSkill(skill: Skill): Promise<void> {
  const cleanSkill = sanitizeSkillSecrets(skill);
  const meta = toSkillMeta(cleanSkill);
  const list = (await listSkills()).filter((s) => s.id !== cleanSkill.id);
  list.unshift(meta);

  // 超量时淘汰最旧
  const overflow = list.slice(MAX_SKILLS);
  const kept = list.slice(0, MAX_SKILLS);
  try {
    await writeSynced(skillKey(cleanSkill.id), cleanSkill);
    await writeIndex(kept);
    if (overflow.length) await removeSynced(overflow.map((s) => skillKey(s.id)));
  } catch {
    /* 容错保护 */
  }
}

export async function loadSkill(id: string): Promise<Skill | null> {
  try {
    const data = await readSynced<Skill>(skillKey(id));
    return data ?? null;
  } catch {
    return null;
  }
}

/** 加载所有技能实体（优先读取云同步，回退本地镜像） */
export async function loadAllSkills(): Promise<Skill[]> {
  const metas = await listSkills();
  const keys = metas.map((m) => skillKey(m.id));
  if (!keys.length) return [];
  try {
    // 优先从 sync 读取，若无则从 local 补全
    let res: Record<string, any> = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      try {
        res = await chrome.storage.sync.get(keys);
      } catch {
        /* 忽略 */
      }
    }
    const missingKeys = keys.filter((k) => !res[k]);
    if (missingKeys.length && typeof chrome !== 'undefined' && chrome.storage?.local) {
      const localRes = await chrome.storage.local.get(missingKeys);
      res = { ...res, ...localRes };
    }

    const result: Skill[] = [];
    for (const m of metas) {
      if (res[skillKey(m.id)]) result.push(res[skillKey(m.id)]);
    }
    return result;
  } catch {
    return [];
  }
}

export async function deleteSkill(id: string): Promise<void> {
  const list = (await listSkills()).filter((s) => s.id !== id);
  await writeIndex(list);
  await removeSynced(skillKey(id));
}

/** 监听技能变更（跨窗口、跨设备实时通知） */
export function onSkillsChange(cb: () => void): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' || area === 'local') {
      const touched = Object.keys(changes).some(
        (k) => k === INDEX_KEY || k.startsWith('skill:'),
      );
      if (touched) cb();
    }
  });
}
