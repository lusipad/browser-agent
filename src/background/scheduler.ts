// 技能定时执行调度器：基于 chrome.alarms 周期/定时唤起与系统通知
import { loadConfig } from '../shared/settings';
import type { Skill, SkillSchedule } from '../shared/skill';
import { resolveSkillSteps } from '../shared/skill';
import { loadAllSkills, loadSkill, onSkillsChange, saveSkill } from '../shared/skillsStore';
import { runTurn } from './agent';
import { Session } from './session';
import { addToAgentGroup } from './tabs';

export const ALARM_PREFIX = 'ba_skill_sched:';

export function alarmName(skillId: string): string {
  return `${ALARM_PREFIX}${skillId}`;
}

export interface ComputedSchedule {
  periodInMinutes: number;
  when?: number;
  delayInMinutes?: number;
}

/** 计算下次执行时间与周期 */
export function computeNextSchedule(schedule: SkillSchedule, now: Date = new Date()): ComputedSchedule | null {
  if (!schedule.enabled) return null;

  switch (schedule.frequency) {
    case '15m':
      return { periodInMinutes: 15, delayInMinutes: 15 };
    case '30m':
      return { periodInMinutes: 30, delayInMinutes: 30 };
    case '1h':
      return { periodInMinutes: 60, delayInMinutes: 60 };
    case '6h':
      return { periodInMinutes: 360, delayInMinutes: 360 };
    case '12h':
      return { periodInMinutes: 720, delayInMinutes: 720 };
    case '24h':
      return { periodInMinutes: 1440, delayInMinutes: 1440 };
    case 'daily': {
      const parts = (schedule.dailyTime || '09:00').split(':');
      const h = Math.min(23, Math.max(0, parseInt(parts[0] || '9', 10)));
      const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10)));

      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return {
        when: target.getTime(),
        periodInMinutes: 1440,
      };
    }
    default:
      return { periodInMinutes: 60, delayInMinutes: 60 };
  }
}

/** 同步所有启用定时调度的技能到 chrome.alarms */
export async function syncAllAlarms(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;

  try {
    const skills = await loadAllSkills();
    const existingAlarms = await chrome.alarms.getAll();
    const existingAlarmNames = new Set(existingAlarms.map((a) => a.name));
    const activeSkillAlarmNames = new Set<string>();

    for (const skill of skills) {
      if (skill.schedule?.enabled) {
        const aName = alarmName(skill.id);
        activeSkillAlarmNames.add(aName);
        const sched = computeNextSchedule(skill.schedule);
        if (sched) {
          await chrome.alarms.create(aName, {
            when: sched.when,
            delayInMinutes: sched.delayInMinutes,
            periodInMinutes: sched.periodInMinutes,
          });
        }
      }
    }

    // 清理已停用或已删除的旧闹钟
    for (const name of existingAlarmNames) {
      if (name.startsWith(ALARM_PREFIX) && !activeSkillAlarmNames.has(name)) {
        await chrome.alarms.clear(name);
      }
    }
  } catch (e) {
    console.error('[scheduler] Failed to sync alarms:', e);
  }
}

/** 触发执行指定的定时技能 */
export async function runScheduledSkill(skillId: string): Promise<boolean> {
  const skill = await loadSkill(skillId);
  if (!skill) return false;

  const sched = skill.schedule ?? {
    enabled: true,
    frequency: '1h',
    notifyOnComplete: true,
  };

  sched.lastStatus = 'running';
  sched.lastRunAt = Date.now();
  sched.lastError = undefined;
  skill.schedule = sched;
  await saveSkill(skill);

  let success = false;
  let errorMsg = '';

  try {
    const cfg = await loadConfig();
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    let targetWindowId = windows[0]?.id;

    if (targetWindowId == null) {
      const createdWin = await chrome.windows.create({ focused: false, state: 'minimized' });
      targetWindowId = createdWin.id!;
    }

    const session = await Session.restore(targetWindowId, cfg);

    // 打开静默背景标签页供技能执行
    const tab = await chrome.tabs.create({
      windowId: targetWindowId,
      url: 'about:blank',
      active: false,
    });

    if (tab.id != null) {
      session.currentTabId = tab.id;
      session.groupedTabs.add(tab.id);
      await addToAgentGroup(targetWindowId, tab.id);
    }

    // 解析技能参数与步骤
    const resolvedVars: Record<string, string | number | boolean> = {};
    const displayVars: Array<[string, string]> = [];

    for (const v of skill.variables) {
      if (v.default !== undefined && v.default !== null && v.default !== '') {
        resolvedVars[v.name] = v.default;
        displayVars.push([v.label || v.name, String(v.default)]);
      } else {
        displayVars.push([v.label || v.name, session.t('skill.autoInferDesc')]);
      }
    }

    const resolvedSteps = resolveSkillSteps(skill, resolvedVars);
    session.activeSkill = {
      name: skill.name,
      description: skill.description,
      steps: resolvedSteps,
      resolvedVars: displayVars,
    };

    const taskText = session.t('skill.executing', [skill.name]);
    await runTurn(session, taskText);

    // 检查是否有致命错误
    const hasError = session.timeline.some((it) => it.kind === 'error');
    if (!hasError && !session.aborted) {
      success = true;
    } else {
      errorMsg = session.timeline.find((it) => it.kind === 'error')?.text || 'Aborted or failed';
    }
  } catch (e: any) {
    errorMsg = e?.message || String(e);
    success = false;
  }

  // 更新执行状态并保存
  const latestSkill = (await loadSkill(skillId)) || skill;
  if (latestSkill.schedule) {
    latestSkill.schedule.lastStatus = success ? 'success' : 'fail';
    latestSkill.schedule.lastRunAt = Date.now();
    latestSkill.schedule.lastError = success ? undefined : errorMsg;
    await saveSkill(latestSkill);
  }

  // 推送完成通知
  if (latestSkill.schedule?.notifyOnComplete !== false && typeof chrome !== 'undefined' && chrome.notifications?.create) {
    try {
      const title = success
        ? `【Browser Agent】定时技能运行成功：${latestSkill.name}`
        : `【Browser Agent】定时技能运行异常：${latestSkill.name}`;
      const message = success
        ? `已在后台自动完成该技能的工作流任务。`
        : `执行遇到错误：${errorMsg || '请在侧边栏或历史中查看详情'}`;

      chrome.notifications.create(`skill_finish:${skillId}:${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title,
        message,
        priority: 1,
      });
    } catch {
      /* 忽略通知失败 */
    }
  }

  return success;
}

/** 初始化调度监听器 */
export function setupScheduler(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;

  // 监听闹钟触发
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith(ALARM_PREFIX)) {
      const skillId = alarm.name.slice(ALARM_PREFIX.length);
      void runScheduledSkill(skillId);
    }
  });

  // 监听通知点击，点击通知激活浏览器窗口
  if (chrome.notifications?.onClicked) {
    chrome.notifications.onClicked.addListener(() => {
      void (async () => {
        try {
          const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
          if (wins[0]?.id) {
            await chrome.windows.update(wins[0].id, { focused: true });
          }
        } catch {
          /* 忽略激活异常 */
        }
      })();
    });
  }

  // 技能库变化时重新同步
  onSkillsChange(() => {
    void syncAllAlarms();
  });

  // 启动即同步一次
  void syncAllAlarms();
}
