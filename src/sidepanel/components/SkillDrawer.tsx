import { useEffect, useState } from 'react';
import type { Skill, SkillMeta, SkillSchedule, SkillStep, SkillVariable } from '../../shared/skill';
import { loadSkill, saveSkill } from '../../shared/skillsStore';
import { useT } from '../../shared/i18nReact';

interface Props {
  skills: SkillMeta[];
  running: boolean;
  onClose: () => void;
  onRun: (skillId: string, variables: Record<string, string | number | boolean>) => void;
  onDelete: (id: string) => void;
  onOptions: (skillId?: string) => void;
  onStartRecording?: () => void;
  initialSkillId?: string | null;
  initialMode?: 'run' | 'edit';
}

export function SkillDrawer({
  skills,
  running,
  onClose,
  onRun,
  onDelete,
  onOptions,
  onStartRecording,
  initialSkillId,
  initialMode = 'run',
}: Props) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(initialSkillId ?? null);
  const [mode, setMode] = useState<'run' | 'edit'>(initialMode);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setActiveSkill(null);
      setEditingSkill(null);
      setFormValues({});
      return;
    }
    setLoading(true);
    void loadSkill(selectedId).then((sk) => {
      setActiveSkill(sk);
      setEditingSkill(sk ? structuredClone(sk) : null);
      if (sk) {
        const initial: Record<string, string | number | boolean> = {};
        for (const v of sk.variables) {
          initial[v.name] = v.default != null ? v.default : v.type === 'boolean' ? false : '';
        }
        setFormValues(initial);
      }
      setLoading(false);
    });
  }, [selectedId]);

  function handleFieldChange(name: string, val: string | number | boolean) {
    setFormValues((prev) => ({ ...prev, [name]: val }));
  }

  function handleRun() {
    if (!activeSkill || running) return;
    onRun(activeSkill.id, formValues);
    onClose();
  }

  async function handleSaveEdit() {
    if (!editingSkill) return;
    setSaving(true);
    const next: Skill = {
      ...editingSkill,
      updatedAt: Date.now(),
    };
    await saveSkill(next);
    setActiveSkill(next);
    setEditingSkill(structuredClone(next));
    setSaving(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  function handleCancelEdit() {
    if (activeSkill) {
      setEditingSkill(structuredClone(activeSkill));
    }
    setMode('run');
  }

  // 步骤编辑
  function addStep() {
    if (!editingSkill) return;
    const newStep: SkillStep = { intent: '' };
    setEditingSkill({ ...editingSkill, steps: [...editingSkill.steps, newStep] });
  }

  function updateStep(index: number, patch: Partial<SkillStep>) {
    if (!editingSkill) return;
    const next = [...editingSkill.steps];
    next[index] = { ...next[index], ...patch };
    setEditingSkill({ ...editingSkill, steps: next });
  }

  function moveStep(index: number, delta: number) {
    if (!editingSkill) return;
    const target = index + delta;
    if (target < 0 || target >= editingSkill.steps.length) return;
    const next = [...editingSkill.steps];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setEditingSkill({ ...editingSkill, steps: next });
  }

  function deleteStep(index: number) {
    if (!editingSkill) return;
    const next = editingSkill.steps.filter((_, i) => i !== index);
    setEditingSkill({ ...editingSkill, steps: next });
  }

  // 变量编辑
  function addVariable() {
    if (!editingSkill) return;
    const newVar: SkillVariable = {
      name: `var_${editingSkill.variables.length + 1}`,
      label: `参数 ${editingSkill.variables.length + 1}`,
      type: 'string',
      required: false,
      placeholder: '',
    };
    setEditingSkill({ ...editingSkill, variables: [...editingSkill.variables, newVar] });
  }

  function updateVariable(index: number, patch: Partial<SkillVariable>) {
    if (!editingSkill) return;
    const next = [...editingSkill.variables];
    next[index] = { ...next[index], ...patch };
    setEditingSkill({ ...editingSkill, variables: next });
  }

  function deleteVariable(index: number) {
    if (!editingSkill) return;
    const next = editingSkill.variables.filter((_, i) => i !== index);
    setEditingSkill({ ...editingSkill, variables: next });
  }

  // 调度编辑
  function updateSchedule(patch: Partial<SkillSchedule>) {
    if (!editingSkill) return;
    const current: SkillSchedule = editingSkill.schedule || {
      enabled: false,
      frequency: '1h',
      dailyTime: '09:00',
      notifyOnComplete: true,
    };
    setEditingSkill({
      ...editingSkill,
      schedule: { ...current, ...patch },
    });
  }

  const canRun = !running && !!activeSkill;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer skill-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-head-left">
            {activeSkill ? (
              <button className="drawer-back" onClick={() => setSelectedId(null)}>
                {t('skill.backToList')}
              </button>
            ) : (
              <span className="drawer-title">{t('skill.drawerTitle')}</span>
            )}
          </div>

          {activeSkill && (
            <div className="skill-mode-toggle">
              <button
                type="button"
                className={`skill-mode-tab ${mode === 'run' ? 'active' : ''}`}
                onClick={() => setMode('run')}
              >
                ▶ {t('skill.runMode')}
              </button>
              <button
                type="button"
                className={`skill-mode-tab ${mode === 'edit' ? 'active' : ''}`}
                onClick={() => setMode('edit')}
              >
                ✏️ {t('skill.editMode')}
              </button>
            </div>
          )}

          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!selectedId ? (
          // 列表模式
          <div className="skill-list-view">
            <div className="skill-teach-head">
              <button
                className="btn primary skill-teach-btn"
                disabled={running}
                onClick={() => {
                  onStartRecording?.();
                  onClose();
                }}
              >
                {t('skill.teachMeBtn')}
              </button>
            </div>
            {skills.length === 0 ? (
              <div className="drawer-empty">{t('skill.empty')}</div>
            ) : (
              <ul className="skill-items">
                {skills.map((s) => (
                  <li
                    key={s.id}
                    className="skill-item"
                    onClick={() => {
                      setSelectedId(s.id);
                      setMode('run');
                    }}
                  >
                    <span className="skill-icon">{s.icon || '⚡'}</span>
                    <div className="skill-info">
                      <div className="skill-name">
                        {s.name}
                        {s.scheduled && <span className="skill-sched-badge" title="已启用定时调度"> ⏰</span>}
                      </div>
                      {s.description && <div className="skill-desc">{s.description}</div>}
                      <div className="skill-meta">
                        <span>{t('skill.stepsCount', [s.stepCount])}</span>
                        {s.variableCount > 0 && (
                          <span> · {t('skill.varsCount', [s.variableCount])}</span>
                        )}
                      </div>
                    </div>
                    <div className="skill-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="skill-action-btn skill-edit-action"
                        title={t('skill.editSkill')}
                        onClick={() => {
                          setSelectedId(s.id);
                          setMode('edit');
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="skill-action-btn skill-del-action"
                        title={t('skill.delTitle')}
                        onClick={() => {
                          if (confirm(t('skill.delConfirm', [s.name]))) {
                            onDelete(s.id);
                          }
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="skill-foot">
              <button
                className="btn secondary skill-manage-btn"
                onClick={() => {
                  onClose();
                  onOptions();
                }}
              >
                {t('skill.manageInOptions')}
              </button>
            </div>
          </div>
        ) : loading || !activeSkill ? (
          <div className="drawer-loading">…</div>
        ) : mode === 'run' ? (
          // 参数配置与运行模式
          <div className="skill-run-view">
            <div className="skill-hero">
              <span className="skill-hero-icon">{activeSkill.icon || '⚡'}</span>
              <div className="skill-hero-content">
                <div className="skill-hero-name">{activeSkill.name}</div>
                {activeSkill.description && (
                  <div className="skill-hero-desc">{activeSkill.description}</div>
                )}
              </div>
              <button
                type="button"
                className="btn-small skill-inline-edit-btn"
                onClick={() => setMode('edit')}
                title={t('skill.editSkill')}
              >
                ✏️ {t('skill.editBtn')}
              </button>
            </div>

            {activeSkill.steps.length > 0 && (
              <div className="skill-steps-preview">
                <div className="skill-section-title">
                  {t('skill.stepsCount', [activeSkill.steps.length])}
                </div>
                <ol className="skill-steps-list">
                  {activeSkill.steps.map((st, i) => (
                    <li key={i} className="skill-step-item">
                      <span>{st.intent}</span>
                      {st.url && <span className="skill-step-url">{st.url}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {activeSkill.variables.length > 0 && (
              <div className="skill-vars-form">
                <div className="skill-section-title">{t('skill.varFill')}</div>
                {activeSkill.variables.map((v) => (
                  <div key={v.name} className="skill-var-field">
                    <label className="skill-var-label">
                      <span>{v.label || v.name}</span>
                      <span className={`skill-var-tag ${v.required ? 'req' : 'opt'}`}>
                        {v.required ? t('skill.required') : t('skill.optional')}
                      </span>
                    </label>
                    {v.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        className="skill-var-checkbox"
                        checked={!!formValues[v.name]}
                        onChange={(e) => handleFieldChange(v.name, e.target.checked)}
                      />
                    ) : v.type === 'number' ? (
                      <input
                        type="number"
                        className="skill-var-input"
                        value={
                          typeof formValues[v.name] === 'number' || typeof formValues[v.name] === 'string'
                            ? (formValues[v.name] as number | string)
                            : ''
                        }
                        placeholder={
                          v.placeholder ||
                          (v.default != null && v.default !== ''
                            ? String(v.default)
                            : t('skill.varAutoInferHint'))
                        }
                        onChange={(e) =>
                          handleFieldChange(
                            v.name,
                            e.target.value === '' ? '' : Number(e.target.value),
                          )
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        className="skill-var-input"
                        value={String(formValues[v.name] ?? '')}
                        placeholder={
                          v.placeholder ||
                          (v.default != null && v.default !== ''
                            ? String(v.default)
                            : t('skill.varAutoInferHint'))
                        }
                        onChange={(e) => handleFieldChange(v.name, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px', padding: '0 2px' }}>
                  {t('skill.autoInferTip')}
                </div>
              </div>
            )}

            <div className="skill-run-foot">
              <button
                className="btn primary skill-run-btn"
                disabled={!canRun}
                onClick={handleRun}
              >
                ▶ {t('skill.runBtn')}
              </button>
            </div>
          </div>
        ) : (
          // 内联编辑模式
          <div className="skill-edit-view">
            {savedNotice && (
              <div className="skill-saved-badge">
                {t('skill.savedToast')}
              </div>
            )}

            {/* 基本信息 */}
            <div className="skill-edit-section">
              <div className="skill-edit-section-title">{t('skill.basicInfo')}</div>
              <div className="skill-edit-grid-2">
                <div className="skill-edit-field icon-col">
                  <label>{t('skill.icon')}</label>
                  <input
                    type="text"
                    className="skill-var-input"
                    value={editingSkill?.icon ?? '⚡'}
                    maxLength={4}
                    onChange={(e) =>
                      editingSkill && setEditingSkill({ ...editingSkill, icon: e.target.value })
                    }
                  />
                </div>
                <div className="skill-edit-field name-col">
                  <label>{t('skill.name')}</label>
                  <input
                    type="text"
                    className="skill-var-input"
                    value={editingSkill?.name ?? ''}
                    onChange={(e) =>
                      editingSkill && setEditingSkill({ ...editingSkill, name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="skill-edit-field">
                <label>{t('skill.desc')}</label>
                <textarea
                  className="skill-var-input skill-edit-textarea"
                  rows={2}
                  value={editingSkill?.description ?? ''}
                  onChange={(e) =>
                    editingSkill && setEditingSkill({ ...editingSkill, description: e.target.value })
                  }
                />
              </div>
            </div>

            {/* 步骤清单 */}
            <div className="skill-edit-section">
              <div className="skill-section-header-row">
                <div className="skill-edit-section-title">
                  {t('skill.steps')} ({editingSkill?.steps.length ?? 0})
                </div>
                <button type="button" className="btn-small" onClick={addStep}>
                  {t('skill.addStep')}
                </button>
              </div>

              <div className="skill-steps-edit-list">
                {(editingSkill?.steps ?? []).map((st, idx) => (
                  <div key={idx} className="skill-step-edit-card">
                    <div className="step-card-head">
                      <span className="step-number">{idx + 1}</span>
                      <div className="step-card-actions">
                        <button
                          type="button"
                          className="step-btn"
                          disabled={idx === 0}
                          onClick={() => moveStep(idx, -1)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="step-btn"
                          disabled={idx === (editingSkill?.steps.length ?? 0) - 1}
                          onClick={() => moveStep(idx, 1)}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="step-del-btn"
                          onClick={() => deleteStep(idx)}
                          title={t('skill.delTitle')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="step-card-body">
                      <textarea
                        className="skill-var-input step-intent-input"
                        placeholder={t('skill.stepIntent')}
                        rows={2}
                        value={st.intent}
                        onChange={(e) => updateStep(idx, { intent: e.target.value })}
                      />
                      <input
                        type="text"
                        className="skill-var-input step-extra-input"
                        placeholder={t('skill.stepUrl')}
                        value={st.url ?? ''}
                        onChange={(e) => updateStep(idx, { url: e.target.value })}
                      />
                      <input
                        type="text"
                        className="skill-var-input step-extra-input"
                        placeholder={t('skill.stepNote')}
                        value={st.note ?? ''}
                        onChange={(e) => updateStep(idx, { note: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 参数变量 */}
            <div className="skill-edit-section">
              <div className="skill-section-header-row">
                <div className="skill-edit-section-title">
                  {t('skill.vars')} ({editingSkill?.variables.length ?? 0})
                </div>
                <button type="button" className="btn-small" onClick={addVariable}>
                  {t('skill.addVar')}
                </button>
              </div>

              {(editingSkill?.variables ?? []).length === 0 ? (
                <div className="skill-empty-tip">固定流程，无动态参数</div>
              ) : (
                <div className="skill-vars-edit-list">
                  {(editingSkill?.variables ?? []).map((v, idx) => (
                    <div key={idx} className="skill-var-edit-card">
                      <div className="var-card-row">
                        <div className="var-card-col">
                          <label>{t('skill.varName')}</label>
                          <input
                            type="text"
                            className="skill-var-input mono"
                            value={v.name}
                            onChange={(e) =>
                              updateVariable(idx, {
                                name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                              })
                            }
                          />
                        </div>
                        <div className="var-card-col">
                          <label>{t('skill.varLabel')}</label>
                          <input
                            type="text"
                            className="skill-var-input"
                            value={v.label}
                            onChange={(e) => updateVariable(idx, { label: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          className="var-del-btn"
                          onClick={() => deleteVariable(idx)}
                          title={t('skill.delTitle')}
                        >
                          ✕
                        </button>
                      </div>

                      <div className="var-card-row">
                        <div className="var-card-col-sm">
                          <label>{t('skill.varType')}</label>
                          <select
                            className="skill-var-input"
                            value={v.type}
                            onChange={(e) =>
                              updateVariable(idx, {
                                type: e.target.value as 'string' | 'number' | 'boolean',
                              })
                            }
                          >
                            <option value="string">{t('skill.typeString')}</option>
                            <option value="number">{t('skill.typeNumber')}</option>
                            <option value="boolean">{t('skill.typeBoolean')}</option>
                          </select>
                        </div>
                        <div className="var-card-col">
                          <label>{t('skill.varDefault')}</label>
                          <input
                            type="text"
                            className="skill-var-input"
                            value={String(v.default ?? '')}
                            placeholder="留空自动分析"
                            onChange={(e) => updateVariable(idx, { default: e.target.value })}
                          />
                        </div>
                        <div className="var-card-col-check">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!v.required}
                              onChange={(e) => updateVariable(idx, { required: e.target.checked })}
                            />
                            <span style={{ fontSize: 11 }}>{t('skill.required')}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 自动化调度 */}
            <div className="skill-edit-section">
              <div className="skill-edit-section-title">{t('skill.scheduleSection')}</div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!editingSkill?.schedule?.enabled}
                    onChange={(e) => updateSchedule({ enabled: e.target.checked })}
                  />
                  <span style={{ fontSize: 12 }}>{t('skill.enableSchedule')}</span>
                </label>

                {editingSkill?.schedule?.enabled && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <select
                      className="skill-var-input"
                      value={editingSkill.schedule.frequency}
                      onChange={(e) => updateSchedule({ frequency: e.target.value as any })}
                    >
                      <option value="15m">每 15 分钟</option>
                      <option value="30m">每 30 分钟</option>
                      <option value="1h">每 1 小时</option>
                      <option value="6h">每 6 小时</option>
                      <option value="12h">每 12 小时</option>
                      <option value="24h">每 24 小时</option>
                      <option value="daily">每天固定时间</option>
                    </select>
                    {editingSkill.schedule.frequency === 'daily' && (
                      <input
                        type="time"
                        className="skill-var-input"
                        value={editingSkill.schedule.dailyTime || '09:00'}
                        onChange={(e) => updateSchedule({ dailyTime: e.target.value })}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 编辑底部操作 */}
            <div className="skill-edit-foot">
              <div className="skill-edit-actions-main">
                <button
                  type="button"
                  className="btn primary skill-save-btn"
                  disabled={saving}
                  onClick={handleSaveEdit}
                >
                  {saving ? '…' : t('skill.saveChanges')}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleCancelEdit}
                >
                  {t('skill.cancelEdit')}
                </button>
              </div>
              <button
                type="button"
                className="btn-text skill-open-opt-btn"
                onClick={() => {
                  onClose();
                  onOptions(editingSkill?.id);
                }}
              >
                {t('skill.openInOptions')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
