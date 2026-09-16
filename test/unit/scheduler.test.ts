import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alarmName,
  ALARM_PREFIX,
  computeNextSchedule,
  syncAllAlarms,
} from '../../src/background/scheduler';
import type { Skill, SkillSchedule } from '../../src/shared/skill';
import { toSkillMeta } from '../../src/shared/skill';
import { saveSkill } from '../../src/shared/skillsStore';

function installMemStorage() {
  const store = new Map<string, unknown>();
  (globalThis as any).chrome = (globalThis as any).chrome || {};
  (globalThis as any).chrome.storage = {
    sync: {
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
    },
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {},
    },
  };
  return store;
}

test('scheduler: alarmName 前缀规范', () => {
  assert.equal(alarmName('my_skill_123'), `${ALARM_PREFIX}my_skill_123`);
});

test('scheduler: computeNextSchedule 禁用时返回 null', () => {
  const sched: SkillSchedule = {
    enabled: false,
    frequency: '1h',
  };
  assert.equal(computeNextSchedule(sched), null);
});

test('scheduler: computeNextSchedule 周期模式 (15m, 30m, 1h, 6h, 12h, 24h)', () => {
  const f15 = computeNextSchedule({ enabled: true, frequency: '15m' });
  assert.deepEqual(f15, { periodInMinutes: 15, delayInMinutes: 15 });

  const f30 = computeNextSchedule({ enabled: true, frequency: '30m' });
  assert.deepEqual(f30, { periodInMinutes: 30, delayInMinutes: 30 });

  const f1h = computeNextSchedule({ enabled: true, frequency: '1h' });
  assert.deepEqual(f1h, { periodInMinutes: 60, delayInMinutes: 60 });

  const f6h = computeNextSchedule({ enabled: true, frequency: '6h' });
  assert.deepEqual(f6h, { periodInMinutes: 360, delayInMinutes: 360 });

  const f12h = computeNextSchedule({ enabled: true, frequency: '12h' });
  assert.deepEqual(f12h, { periodInMinutes: 720, delayInMinutes: 720 });

  const f24h = computeNextSchedule({ enabled: true, frequency: '24h' });
  assert.deepEqual(f24h, { periodInMinutes: 1440, delayInMinutes: 1440 });
});

test('scheduler: computeNextSchedule daily 模式准确计算下次时间戳', () => {
  // 假设当前时间是 2026-09-17 08:00:00
  const morning = new Date(2026, 8, 17, 8, 0, 0);
  const resSameDay = computeNextSchedule(
    { enabled: true, frequency: 'daily', dailyTime: '09:30' },
    morning,
  );
  assert.ok(resSameDay?.when);
  const targetDate = new Date(resSameDay.when);
  assert.equal(targetDate.getFullYear(), 2026);
  assert.equal(targetDate.getDate(), 17);
  assert.equal(targetDate.getHours(), 9);
  assert.equal(targetDate.getMinutes(), 30);
  assert.equal(resSameDay.periodInMinutes, 1440);

  // 假设当前时间是 2026-09-17 10:00:00，已超过 09:30，应跨至次日
  const afternoon = new Date(2026, 8, 17, 10, 0, 0);
  const resNextDay = computeNextSchedule(
    { enabled: true, frequency: 'daily', dailyTime: '09:30' },
    afternoon,
  );
  assert.ok(resNextDay?.when);
  const nextTargetDate = new Date(resNextDay.when);
  assert.equal(nextTargetDate.getFullYear(), 2026);
  assert.equal(nextTargetDate.getDate(), 18); // 次日
  assert.equal(nextTargetDate.getHours(), 9);
  assert.equal(nextTargetDate.getMinutes(), 30);
});

test('scheduler: toSkillMeta 包含 scheduled 状态', () => {
  const sk1: Skill = {
    id: 'sk1',
    name: '普通技能',
    description: '',
    icon: '⚡',
    version: 1,
    variables: [],
    steps: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
  assert.equal(toSkillMeta(sk1).scheduled, false);

  const sk2: Skill = {
    ...sk1,
    id: 'sk2',
    schedule: { enabled: true, frequency: '1h' },
  };
  assert.equal(toSkillMeta(sk2).scheduled, true);
});

test('scheduler: syncAllAlarms 注册启用调度的技能并清理禁用旧闹钟', async () => {
  installMemStorage();

  const createdAlarms: Record<string, any> = {};
  const clearedAlarms: string[] = [];

  (globalThis as any).chrome.alarms = {
    getAll: async () => [
      { name: `${ALARM_PREFIX}obsolete_skill` },
      { name: 'other_alarm' },
    ],
    create: async (name: string, info: any) => {
      createdAlarms[name] = info;
    },
    clear: async (name: string) => {
      clearedAlarms.push(name);
    },
  };

  const skillActive: Skill = {
    id: 'act1',
    name: '定时监控',
    description: '',
    icon: '📈',
    version: 1,
    variables: [],
    steps: [],
    schedule: { enabled: true, frequency: '30m' },
    createdAt: 1000,
    updatedAt: 1000,
  };

  const skillInactive: Skill = {
    id: 'inact2',
    name: '手动技能',
    description: '',
    icon: '⚡',
    version: 1,
    variables: [],
    steps: [],
    schedule: { enabled: false, frequency: '1h' },
    createdAt: 1000,
    updatedAt: 1000,
  };

  await saveSkill(skillActive);
  await saveSkill(skillInactive);

  await syncAllAlarms();

  // 验证 act1 闹钟已注册
  assert.ok(createdAlarms[`${ALARM_PREFIX}act1`]);
  assert.equal(createdAlarms[`${ALARM_PREFIX}act1`].periodInMinutes, 30);

  // 验证旧闹钟已清理，非前缀闹钟保留
  assert.ok(clearedAlarms.includes(`${ALARM_PREFIX}obsolete_skill`));
  assert.ok(!clearedAlarms.includes('other_alarm'));
});
