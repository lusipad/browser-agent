import { useEffect, useRef, useState } from 'react';
import { parseImportedSkills, type Skill, type SkillSchedule, type SkillStep, type SkillVariable } from '../../shared/skill';
import { deleteSkill, loadAllSkills, onSkillsChange, saveSkill } from '../../shared/skillsStore';
import { uid } from '../../shared/util';
import { useT } from '../../shared/i18nReact';
import { Field } from './common';

export function SkillsPanel({ initialSkillId }: { initialSkillId?: string | null } = {}) {
  const t = useT();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadAllSkills().then((list) => {
      setSkills(list);
      if (list.length) {
        const target =
          (initialSkillId && list.find((s) => s.id === initialSkillId)) ||
          (selectedId && list.find((s) => s.id === selectedId)) ||
          list[0];
        setSelectedId(target.id);
        setEditing(structuredClone(target));
      }
    });
  }, [initialSkillId]);

  useEffect(() => {
    onSkillsChange(() => {
      void loadAllSkills().then((list) => {
        setSkills(list);
      });
    });
  }, []);

  function selectSkill(s: Skill) {
    setSelectedId(s.id);
    setEditing(structuredClone(s));
  }

  function createNewSkill() {
    const newSkill: Skill = {
      id: uid('skill'),
      name: '新技能',
      description: '',
      icon: '⚡',
      version: 1,
      variables: [
        {
          name: 'keyword',
          label: '关键词',
          type: 'string',
          required: true,
          placeholder: '输入搜索词',
        },
      ],
      steps: [
        {
          intent: '打开搜索页面并输入 {{keyword}}',
          url: 'https://www.google.com',
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newSkill, ...skills];
    setSkills(updated);
    setSelectedId(newSkill.id);
    setEditing(newSkill);
    void saveSkill(newSkill);
  }

  async function handleSave() {
    if (!editing) return;
    const next: Skill = {
      ...editing,
      updatedAt: Date.now(),
    };
    await saveSkill(next);
    setSkills((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    setEditing(next);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  function updateSchedule(patch: Partial<SkillSchedule>) {
    if (!editing) return;
    const current: SkillSchedule = editing.schedule || {
      enabled: false,
      frequency: '1h',
      dailyTime: '09:00',
      notifyOnComplete: true,
    };
    setEditing({
      ...editing,
      schedule: { ...current, ...patch },
    });
  }

  const [testingRun, setTestingRun] = useState(false);

  async function handleTestRun() {
    if (!editing || testingRun) return;
    setTestingRun(true);
    try {
      await handleSave();
      chrome.runtime.sendMessage({ type: 'run_scheduled_skill', skillId: editing.id }, async (resp) => {
        setTestingRun(false);
        const list = await loadAllSkills();
        setSkills(list);
        const updated = list.find((s) => s.id === editing.id);
        if (updated) setEditing(structuredClone(updated));
      });
    } catch {
      setTestingRun(false);
    }
  }

  async function handleDelete(id: string) {
    const target = skills.find((s) => s.id === id);
    if (!target) return;
    if (!confirm(t('opt.skills.delConfirm', [target.name]))) return;
    await deleteSkill(id);
    const remaining = skills.filter((s) => s.id !== id);
    setSkills(remaining);
    if (selectedId === id) {
      if (remaining.length) {
        selectSkill(remaining[0]);
      } else {
        setSelectedId(null);
        setEditing(null);
      }
    }
  }

  function handleExportAll() {
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-agent-skills-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportOne(skill: Skill) {
    const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-${skill.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const toImport = parseImportedSkills(raw);
        if (toImport.length > 0) {
          for (const sk of toImport) {
            await saveSkill(sk);
          }
          alert(t('opt.skills.importSuccess', [toImport.length]));
          const list = await loadAllSkills();
          setSkills(list);
          if (list.length) selectSkill(list[0]);
        } else {
          alert(t('opt.skills.importFail'));
        }
      } catch {
        alert(t('opt.skills.importFail'));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  // 变量操作
  function addVariable() {
    if (!editing) return;
    const newVar: SkillVariable = {
      name: `var_${editing.variables.length + 1}`,
      label: `参数 ${editing.variables.length + 1}`,
      type: 'string',
      required: true,
      placeholder: '',
    };
    setEditing({ ...editing, variables: [...editing.variables, newVar] });
  }

  function updateVariable(index: number, patch: Partial<SkillVariable>) {
    if (!editing) return;
    const next = [...editing.variables];
    next[index] = { ...next[index], ...patch };
    setEditing({ ...editing, variables: next });
  }

  function deleteVariable(index: number) {
    if (!editing) return;
    const next = editing.variables.filter((_, i) => i !== index);
    setEditing({ ...editing, variables: next });
  }

  // 步骤操作
  function addStep() {
    if (!editing) return;
    const newStep: SkillStep = {
      intent: '',
    };
    setEditing({ ...editing, steps: [...editing.steps, newStep] });
  }

  function updateStep(index: number, patch: Partial<SkillStep>) {
    if (!editing) return;
    const next = [...editing.steps];
    next[index] = { ...next[index], ...patch };
    setEditing({ ...editing, steps: next });
  }

  function moveStep(index: number, delta: number) {
    if (!editing) return;
    const target = index + delta;
    if (target < 0 || target >= editing.steps.length) return;
    const next = [...editing.steps];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setEditing({ ...editing, steps: next });
  }

  function deleteStep(index: number) {
    if (!editing) return;
    const next = editing.steps.filter((_, i) => i !== index);
    setEditing({ ...editing, steps: next });
  }

  return (
    <div className="panel skills-panel">
      <div className="panel-header-row">
        <div>
          <h1>{t('opt.skills.title')}</h1>
          <p className="lead">{t('opt.skills.lead')}</p>
        </div>
        <div className="skills-top-actions">
          <button className="btn secondary" onClick={createNewSkill}>
            {t('opt.skills.new')}
          </button>
          <button className="btn secondary" onClick={handleExportAll} disabled={!skills.length}>
            {t('opt.skills.exportAll')}
          </button>
          <button className="btn secondary" onClick={() => fileInputRef.current?.click()}>
            {t('opt.skills.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      <div className="skills-layout">
        {/* 左侧：技能列表 */}
        <div className="skills-nav">
          {skills.length === 0 ? (
            <div className="skills-nav-empty">
              <p>{t('opt.skills.empty')}</p>
              <span className="skills-nav-tip">{t('opt.skills.emptyTip')}</span>
            </div>
          ) : (
            <ul className="skills-nav-list">
              {skills.map((s) => (
                <li
                  key={s.id}
                  className={`skills-nav-item ${s.id === selectedId ? 'active' : ''}`}
                  onClick={() => selectSkill(s)}
                >
                  <span className="skills-nav-icon">{s.icon || '⚡'}</span>
                  <div className="skills-nav-info">
                    <div className="skills-nav-name">{s.name}</div>
                    <div className="skills-nav-meta">
                      {s.steps.length} 步 · {s.variables.length} 变量
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 右侧：编辑器 */}
        <div className="skills-editor">
          {editing ? (
            <div className="skill-editor-form">
              {/* 基本信息 */}
              <div className="card">
                <div className="card-title-row">
                  <span className="card-title">{t('opt.skills.title')}</span>
                  {savedNotice && <span className="saved-badge">✓ {t('opt.shell.saved')}</span>}
                </div>
                <div className="grid-2col">
                  <Field label={t('opt.skills.icon')}>
                    <input
                      type="text"
                      className="input-text icon-input"
                      value={editing.icon}
                      maxLength={4}
                      onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                    />
                  </Field>
                  <Field label={t('opt.skills.name')}>
                    <input
                      type="text"
                      className="input-text"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label={t('opt.skills.desc')}>
                  <textarea
                    className="input-text textarea-desc"
                    value={editing.description}
                    rows={2}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </Field>
              </div>

              {/* 参数变量 */}
              <div className="card">
                <div className="card-title-row">
                  <span className="card-title">{t('opt.skills.vars')}</span>
                  <button className="btn-small" onClick={addVariable}>
                    {t('opt.skills.addVar')}
                  </button>
                </div>

                {editing.variables.length === 0 ? (
                  <div className="subtle-empty">无参数配置（固定工作流）</div>
                ) : (
                  <div className="skill-vars-table">
                    {editing.variables.map((v, idx) => (
                      <div key={idx} className="skill-var-row">
                        <div className="skill-var-col">
                          <label>{t('opt.skills.varName')}</label>
                          <input
                            type="text"
                            className="input-text mono"
                            value={v.name}
                            onChange={(e) =>
                              updateVariable(idx, {
                                name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                              })
                            }
                          />
                        </div>
                        <div className="skill-var-col">
                          <label>{t('opt.skills.varLabel')}</label>
                          <input
                            type="text"
                            className="input-text"
                            value={v.label}
                            onChange={(e) => updateVariable(idx, { label: e.target.value })}
                          />
                        </div>
                        <div className="skill-var-col-type">
                          <label>{t('opt.skills.varType')}</label>
                          <select
                            className="input-select"
                            value={v.type}
                            onChange={(e) =>
                              updateVariable(idx, {
                                type: e.target.value as 'string' | 'number' | 'boolean',
                              })
                            }
                          >
                            <option value="string">文本 (string)</option>
                            <option value="number">数字 (number)</option>
                            <option value="boolean">开关 (boolean)</option>
                          </select>
                        </div>
                        <div className="skill-var-col">
                          <label>{t('opt.skills.varDefault')}</label>
                          <input
                            type="text"
                            className="input-text"
                            value={String(v.default ?? '')}
                            onChange={(e) => updateVariable(idx, { default: e.target.value })}
                          />
                        </div>
                        <div className="skill-var-col-req">
                          <label>{t('opt.skills.varRequired')}</label>
                          <input
                            type="checkbox"
                            checked={v.required}
                            onChange={(e) => updateVariable(idx, { required: e.target.checked })}
                          />
                        </div>
                        <button
                          className="row-del-btn"
                          title={t('opt.common.delete')}
                          onClick={() => deleteVariable(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 步骤清单 */}
              <div className="card">
                <div className="card-title-row">
                  <span className="card-title">{t('opt.skills.steps')}</span>
                  <button className="btn-small" onClick={addStep}>
                    {t('opt.skills.addStep')}
                  </button>
                </div>

                {editing.steps.length === 0 ? (
                  <div className="subtle-empty">无步骤，请点击“添加步骤”</div>
                ) : (
                  <div className="skill-steps-editor">
                    {editing.steps.map((st, idx) => (
                      <div key={idx} className="skill-step-row">
                        <div className="step-badge">{idx + 1}</div>
                        <div className="step-fields">
                          <input
                            type="text"
                            className="input-text step-intent"
                            placeholder={t('opt.skills.stepIntent')}
                            value={st.intent}
                            onChange={(e) => updateStep(idx, { intent: e.target.value })}
                          />
                          <div className="grid-2col">
                            <input
                              type="text"
                              className="input-text"
                              placeholder={t('opt.skills.stepUrl')}
                              value={st.url ?? ''}
                              onChange={(e) => updateStep(idx, { url: e.target.value })}
                            />
                            <input
                              type="text"
                              className="input-text"
                              placeholder={t('opt.skills.stepNote')}
                              value={st.note ?? ''}
                              onChange={(e) => updateStep(idx, { note: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="step-actions">
                          <button
                            className="step-btn"
                            disabled={idx === 0}
                            onClick={() => moveStep(idx, -1)}
                          >
                            ▲
                          </button>
                          <button
                            className="step-btn"
                            disabled={idx === editing.steps.length - 1}
                            onClick={() => moveStep(idx, 1)}
                          >
                            ▼
                          </button>
                          <button
                            className="row-del-btn"
                            title={t('opt.common.delete')}
                            onClick={() => deleteStep(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 定时调度与自动化运行 */}
              <div className="card">
                <div className="card-title-row">
                  <span className="card-title">{t('opt.skills.scheduleTitle')}</span>
                  <div className="skill-sched-toggle">
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!editing.schedule?.enabled}
                        onChange={(e) => updateSchedule({ enabled: e.target.checked })}
                      />
                      <span style={{ marginLeft: 6, fontSize: 13 }}>{t('opt.skills.enableSchedule')}</span>
                    </label>
                  </div>
                </div>

                {editing.schedule?.enabled ? (
                  <div className="skill-schedule-body">
                    <div className="grid-2col" style={{ marginBottom: 12 }}>
                      <Field label={t('opt.skills.frequency')} hint={t('opt.skills.frequencyDesc')}>
                        <select
                          className="select-input"
                          value={editing.schedule.frequency}
                          onChange={(e) => updateSchedule({ frequency: e.target.value as any })}
                        >
                          <option value="15m">{t('opt.skills.freq15m')}</option>
                          <option value="30m">{t('opt.skills.freq30m')}</option>
                          <option value="1h">{t('opt.skills.freq1h')}</option>
                          <option value="6h">{t('opt.skills.freq6h')}</option>
                          <option value="12h">{t('opt.skills.freq12h')}</option>
                          <option value="24h">{t('opt.skills.freq24h')}</option>
                          <option value="daily">{t('opt.skills.freqDaily')}</option>
                        </select>
                      </Field>

                      {editing.schedule.frequency === 'daily' && (
                        <Field label={t('opt.skills.dailyTime')} hint={t('opt.skills.dailyTimeDesc')}>
                          <input
                            type="time"
                            className="input-text"
                            value={editing.schedule.dailyTime || '09:00'}
                            onChange={(e) => updateSchedule({ dailyTime: e.target.value })}
                          />
                        </Field>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editing.schedule.notifyOnComplete !== false}
                          onChange={(e) => updateSchedule({ notifyOnComplete: e.target.checked })}
                        />
                        <span style={{ marginLeft: 6, fontSize: 13 }}>{t('opt.skills.notifyOnComplete')}</span>
                      </label>
                    </div>

                    <div className="skill-sched-status-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div className="skill-sched-last-info" style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                        {editing.schedule.lastRunAt ? (
                          <>
                            <span>{t('opt.skills.lastRun')}: {new Date(editing.schedule.lastRunAt).toLocaleString()}</span>
                            <span style={{
                              marginLeft: 8,
                              fontWeight: 600,
                              color: editing.schedule.lastStatus === 'success' ? 'var(--ok)' : editing.schedule.lastStatus === 'running' ? '#f59e0b' : 'var(--err)',
                            }}>
                              {editing.schedule.lastStatus === 'success' ? `✓ ${t('opt.skills.statusSuccess')}` : editing.schedule.lastStatus === 'running' ? `⏳ ${t('opt.skills.statusRunning')}` : `✕ ${t('opt.skills.statusFail')}`}
                            </span>
                            {editing.schedule.lastError && (
                              <div style={{ color: 'var(--err)', marginTop: 2 }}>{editing.schedule.lastError}</div>
                            )}
                          </>
                        ) : (
                          <span>{t('opt.skills.neverRun')}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn secondary"
                        disabled={testingRun}
                        onClick={handleTestRun}
                      >
                        {testingRun ? t('opt.skills.runningTest') : t('opt.skills.runTestBtn')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="subtle-empty" style={{ padding: '8px 0', color: 'var(--text-dim)', fontSize: 12.5 }}>
                    {t('opt.skills.scheduleDisabledTip')}
                  </div>
                )}
              </div>

              {/* 底部操作 */}
              <div className="skills-editor-footer">
                <button className="btn primary" onClick={handleSave}>
                  {t('opt.skills.save')}
                </button>
                <button className="btn secondary" onClick={() => handleExportOne(editing)}>
                  {t('opt.skills.exportOne')}
                </button>
                <button className="btn danger" onClick={() => handleDelete(editing.id)}>
                  {t('opt.skills.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div className="skills-empty-detail">
              <p>{t('opt.skills.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
