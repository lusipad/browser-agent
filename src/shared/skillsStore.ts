// 技能持久化存储（chrome.storage.local），支持列表 / 加载 / 保存 / 删除 / 全部加载
import type { Skill, SkillMeta } from './skill';
import { toSkillMeta } from './skill';

const INDEX_KEY = 'skill_index';
const skillKey = (id: string) => `skill:${id}`;
const MAX_SKILLS = 50;

export async function listSkills(): Promise<SkillMeta[]> {
  try {
    const idx = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] as SkillMeta[] | undefined;
    return Array.isArray(idx) ? idx.slice().sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

async function writeIndex(list: SkillMeta[]): Promise<void> {
  await chrome.storage.local.set({ [INDEX_KEY]: list });
}

/** 保存 / 更新一个技能 */
export async function saveSkill(skill: Skill): Promise<void> {
  const meta = toSkillMeta(skill);
  const list = (await listSkills()).filter((s) => s.id !== skill.id);
  list.unshift(meta);

  // 超量时淘汰最旧
  const overflow = list.slice(MAX_SKILLS);
  const kept = list.slice(0, MAX_SKILLS);
  try {
    await chrome.storage.local.set({ [skillKey(skill.id)]: skill });
    await writeIndex(kept);
    if (overflow.length) await chrome.storage.local.remove(overflow.map((s) => skillKey(s.id)));
  } catch {
    /* 配额不足：放弃本次保存 */
  }
}

export async function loadSkill(id: string): Promise<Skill | null> {
  try {
    const data = (await chrome.storage.local.get(skillKey(id)))[skillKey(id)] as Skill | undefined;
    return data ?? null;
  } catch {
    return null;
  }
}

/** 加载所有技能实体（用于设置页编辑和导出） */
export async function loadAllSkills(): Promise<Skill[]> {
  const metas = await listSkills();
  const keys = metas.map((m) => skillKey(m.id));
  if (!keys.length) return [];
  try {
    const res = await chrome.storage.local.get(keys);
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
  await chrome.storage.local.remove(skillKey(id));
}
