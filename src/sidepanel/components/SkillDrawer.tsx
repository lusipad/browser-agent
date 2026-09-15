import { useEffect, useState } from 'react';
import type { Skill, SkillMeta } from '../../shared/skill';
import { loadSkill } from '../../shared/skillsStore';
import { useT } from '../../shared/i18nReact';

interface Props {
  skills: SkillMeta[];
  running: boolean;
  onClose: () => void;
  onRun: (skillId: string, variables: Record<string, string | number | boolean>) => void;
  onDelete: (id: string) => void;
  onOptions: () => void;
}

export function SkillDrawer({ skills, running, onClose, onRun, onDelete, onOptions }: Props) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setActiveSkill(null);
      setFormValues({});
      return;
    }
    setLoading(true);
    void loadSkill(selectedId).then((sk) => {
      setActiveSkill(sk);
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

  // 验证必填字段
  const canRun =
    !running &&
    activeSkill &&
    activeSkill.variables.every((v) => {
      if (!v.required) return true;
      const val = formValues[v.name];
      if (val === undefined || val === null || val === '') return false;
      return true;
    });

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer skill-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">
            {activeSkill ? (
              <button className="drawer-back" onClick={() => setSelectedId(null)}>
                {t('skill.backToList')}
              </button>
            ) : (
              t('skill.drawerTitle')
            )}
          </span>
          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!selectedId ? (
          // 列表模式
          <div className="skill-list-view">
            {skills.length === 0 ? (
              <div className="drawer-empty">{t('skill.empty')}</div>
            ) : (
              <ul className="skill-items">
                {skills.map((s) => (
                  <li
                    key={s.id}
                    className="skill-item"
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className="skill-icon">{s.icon || '⚡'}</span>
                    <div className="skill-info">
                      <div className="skill-name">{s.name}</div>
                      {s.description && <div className="skill-desc">{s.description}</div>}
                      <div className="skill-meta">
                        <span>{t('skill.stepsCount', [s.stepCount])}</span>
                        {s.variableCount > 0 && (
                          <span> · {t('skill.varsCount', [s.variableCount])}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="skill-del"
                      title={t('skill.delTitle')}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('skill.delConfirm', [s.name]))) {
                          onDelete(s.id);
                        }
                      }}
                    >
                      🗑
                    </button>
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
        ) : (
          // 参数配置与运行模式
          <div className="skill-run-view">
            {loading || !activeSkill ? (
              <div className="drawer-loading">…</div>
            ) : (
              <>
                <div className="skill-hero">
                  <span className="skill-hero-icon">{activeSkill.icon || '⚡'}</span>
                  <div>
                    <div className="skill-hero-name">{activeSkill.name}</div>
                    {activeSkill.description && (
                      <div className="skill-hero-desc">{activeSkill.description}</div>
                    )}
                  </div>
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
                            placeholder={v.placeholder}
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
                            placeholder={v.placeholder}
                            onChange={(e) => handleFieldChange(v.name, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
