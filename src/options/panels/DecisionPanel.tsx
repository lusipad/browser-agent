import { useState } from 'react';
import type { System1Config, System1ProviderType } from '../../shared/types';
import { DEFAULT_SYSTEM1_CONFIG } from '../../shared/settings';
import { useT } from '../../shared/i18nReact';
import { executeSystem1Decision } from '../../system1';
import { Field, NumberInput, Toggle, type PanelProps } from './common';

export function DecisionPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const sys1 = cfg.system1 ?? DEFAULT_SYSTEM1_CONFIG;

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    action?: string;
    model?: string;
    message?: string;
  } | null>(null);

  function patchSys1(patch: Partial<System1Config>) {
    void onChange({
      ...cfg,
      system1: {
        ...DEFAULT_SYSTEM1_CONFIG,
        ...cfg.system1,
        ...patch,
      },
    });
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const dummyState = {
        goal: 'Click the confirm button to continue',
        elements: [
          { ref: '1', role: 'button', name: 'Confirm', inView: true, x: 100, y: 200 },
          { ref: '2', role: 'button', name: 'Cancel', inView: true, x: 200, y: 200 },
        ],
        pageUrl: 'https://example.com/test',
        pageTitle: 'Test Checkout Page',
      };

      const decision = await executeSystem1Decision(sys1, dummyState);
      const elapsed = Math.round(performance.now() - start);

      setTestResult({
        ok: true,
        latencyMs: decision.latencyMs ?? elapsed,
        action: `${decision.action}${decision.targetRef ? ` [${decision.targetRef}]` : ''}`,
        model: sys1.model || (sys1.provider === 'laya-local' ? 'laya-modernbert-large' : 'jev-latest'),
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || String(err),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="panel decision-panel">
      <div className="panel-head">
        <h1>{t('opt.system1.title')}</h1>
        <p className="lead">{t('opt.system1.lead')}</p>
      </div>

      {/* 🧠 认知科学双核架构图解 */}
      <div className="card" style={{ background: 'var(--bg-soft, rgba(0,0,0,0.02))', borderColor: 'var(--border)' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 10px 0' }}>
          {t('opt.decision.archTitle')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#e59900', fontWeight: 600, flexShrink: 0 }}>⚡ System 1:</span>
            <span>{t('opt.decision.archS1')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>🧠 System 2:</span>
            <span>{t('opt.decision.archS2')}</span>
          </div>
        </div>
      </div>

      {/* 主开关 */}
      <div className="card">
        <Toggle
          checked={sys1.enabled}
          onChange={(v) => patchSys1({ enabled: v })}
          label={t('opt.system1.enable')}
          hint={t('opt.system1.enableHint')}
        />
      </div>

      {sys1.enabled && (
        <>
          {/* 提供商预设选择 */}
          <div className="card">
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 12px 0' }}>{t('opt.system1.provider')}</h2>
            <Field label={t('opt.system1.provider')}>
              <select
                value={sys1.provider}
                onChange={(e) => {
                  const p = e.target.value as System1ProviderType;
                  if (p === 'typesafe') {
                    patchSys1({
                      provider: p,
                      baseUrl: 'https://api.typesafe.ai/v1',
                      model: 'jev-latest',
                    });
                  } else if (p === 'laya-local') {
                    patchSys1({
                      provider: p,
                      baseUrl: 'http://localhost:8000/v1',
                      model: 'laya-modernbert-large',
                    });
                  } else {
                    patchSys1({ provider: p });
                  }
                }}
              >
                <option value="typesafe">{t('opt.system1.provider.typesafe')}</option>
                <option value="laya-local">{t('opt.system1.provider.laya')}</option>
                <option value="custom">{t('opt.system1.provider.custom')}</option>
              </select>
            </Field>

            <div className="card-row" style={{ marginTop: 12 }}>
              <Field label={t('opt.system1.baseUrl')}>
                <input
                  type="text"
                  value={sys1.baseUrl}
                  placeholder={sys1.provider === 'laya-local' ? 'http://localhost:8000/v1' : 'https://api.typesafe.ai/v1'}
                  onChange={(e) => patchSys1({ baseUrl: e.target.value })}
                />
              </Field>
              <Field label={t('opt.system1.apiKey')}>
                <input
                  type="password"
                  value={sys1.apiKey}
                  placeholder={sys1.provider === 'laya-local' ? '本地通常无需 Key (可选)' : 'ts-***'}
                  onChange={(e) => patchSys1({ apiKey: e.target.value })}
                />
              </Field>
            </div>

            <div className="card-row" style={{ marginTop: 12 }}>
              <Field label={t('opt.system1.model')}>
                <input
                  type="text"
                  value={sys1.model}
                  placeholder={sys1.provider === 'laya-local' ? 'laya-modernbert-large' : 'jev-latest'}
                  onChange={(e) => patchSys1({ model: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* ⚡ 连通性测试与时延 Benchmark */}
          <div className="card">
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 10px 0' }}>
              ⚡ 连通性测试与时延评估
            </h2>
            <p className="hint" style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              模拟发送一个 DOM 动作分类请求，即时检验端点是否可用，并测试端到端决策时延（通常在 4ms ~ 50ms）。
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary"
                disabled={testing}
                onClick={handleTestConnection}
                style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {testing ? t('opt.decision.testing') : t('opt.decision.testBtn')}
              </button>

              {testResult && (
                <div
                  style={{
                    fontSize: '0.85rem',
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: testResult.ok ? 'rgba(63, 185, 80, 0.12)' : 'rgba(229, 72, 77, 0.12)',
                    color: testResult.ok ? '#2da44e' : '#e5484d',
                    border: `1px solid ${testResult.ok ? 'rgba(63, 185, 80, 0.3)' : 'rgba(229, 72, 77, 0.3)'}`,
                  }}
                >
                  {testResult.ok
                    ? t('opt.decision.testSuccess', [
                        testResult.model || sys1.model,
                        testResult.action || 'OK',
                        testResult.latencyMs ?? 0,
                      ])
                    : t('opt.decision.testFail', [testResult.message || 'Error'])}
                </div>
              )}
            </div>
          </div>

          {/* 决策参数微调 */}
          <div className="card">
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 12px 0' }}>决策阈值与风控参数</h2>
            <div className="card-row">
              <Field
                label={t('opt.system1.minConfidence')}
                hint="决策引擎判断有把握才执行，低于该置信度自动交还主大模型（默认 0.60）"
              >
                <NumberInput
                  value={sys1.minConfidence}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  fallback={0.6}
                  onChange={(val) => patchSys1({ minConfidence: val ?? 0.6 })}
                />
              </Field>
              <Field
                label={t('opt.system1.maxFastSteps')}
                hint="单次任务中允许连续快决策的最大步数，防止死循环点击（默认 8 步）"
              >
                <NumberInput
                  value={sys1.maxConsecutiveFastSteps}
                  min={1}
                  max={50}
                  step={1}
                  fallback={8}
                  onChange={(val) => patchSys1({ maxConsecutiveFastSteps: val ?? 8 })}
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
