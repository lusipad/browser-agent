import { useEffect, useState } from 'react';
import type { AdvancedSettings, System1Config, System1ProviderType } from '../../shared/types';
import { DEFAULT_SYSTEM1_CONFIG } from '../../shared/settings';
import { useT } from '../../shared/i18nReact';
import { Field, Toggle, type PanelProps } from './common';

function NumberInput({
  value,
  min,
  max,
  step,
  fallback,
  placeholder,
  onChange,
}: {
  value: number | null | undefined;
  min: number;
  max: number;
  step?: number;
  fallback: number | null;
  placeholder?: string;
  onChange: (val: number | null) => void;
}) {
  const [localVal, setLocalVal] = useState<string>(value == null ? '' : String(value));

  useEffect(() => {
    setLocalVal(value == null ? '' : String(value));
  }, [value]);

  function commit() {
    const trimmed = localVal.trim();
    if (trimmed === '') {
      onChange(fallback);
      setLocalVal(fallback == null ? '' : String(fallback));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      onChange(fallback);
      setLocalVal(fallback == null ? '' : String(fallback));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    setLocalVal(String(clamped));
  }

  return (
    <input
      type="number"
      value={localVal}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function AdvancedPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const a = cfg.advanced;
  const sys1: System1Config = cfg.system1 ?? DEFAULT_SYSTEM1_CONFIG;
  function patch(p: Partial<AdvancedSettings>) {
    onChange({ ...cfg, advanced: { ...a, ...p } });
  }
  function patchSys1(p: Partial<System1Config>) {
    onChange({ ...cfg, system1: { ...sys1, ...p } });
  }

  return (
    <div className="panel">
      <h1>{t('opt.advanced.title')}</h1>
      <p className="lead">{t('opt.advanced.lead')}</p>

      <div className="card">
        <Field label={t('opt.lang.label')}>
          <select
            value={cfg.uiLang}
            onChange={(e) => onChange({ ...cfg, uiLang: e.target.value as 'auto' | 'zh' | 'en' })}
          >
            <option value="auto">{t('opt.lang.auto')}</option>
            <option value="zh">{t('opt.lang.zh')}</option>
            <option value="en">{t('opt.lang.en')}</option>
          </select>
        </Field>
      </div>

      <div className="card">
        <div className="card-row">
          <Field label={t('opt.advanced.maxIterations')} hint={t('opt.advanced.maxIterationsHint')}>
            <NumberInput
              value={a.maxIterations}
              min={1}
              max={500}
              fallback={100}
              onChange={(val) => patch({ maxIterations: val ?? 100 })}
            />
          </Field>
          <Field label={t('opt.advanced.maxImagesKept')} hint={t('opt.advanced.maxImagesKeptHint')}>
            <NumberInput
              value={a.maxImagesKept}
              min={0}
              max={20}
              fallback={4}
              onChange={(val) => patch({ maxImagesKept: val ?? 4 })}
            />
          </Field>
        </div>
        <Field label={t('opt.advanced.maxContextTokens')} hint={t('opt.advanced.maxContextTokensHint')}>
          <NumberInput
            value={a.maxContextTokens}
            min={8000}
            max={1000000}
            step={4000}
            fallback={96000}
            onChange={(val) => patch({ maxContextTokens: val ?? 96000 })}
          />
        </Field>
        <div className="card-row">
          <Field label={t('opt.advanced.screenshotMaxWidth')} hint={t('opt.advanced.screenshotMaxWidthHint')}>
            <NumberInput
              value={a.screenshotMaxWidth}
              min={640}
              max={2560}
              step={64}
              fallback={1366}
              onChange={(val) => patch({ screenshotMaxWidth: val ?? 1366 })}
            />
          </Field>
          <Field label={t('opt.advanced.jpegQuality')}>
            <NumberInput
              value={a.jpegQuality}
              min={30}
              max={100}
              fallback={80}
              onChange={(val) => patch({ jpegQuality: val ?? 80 })}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <Field label={t('opt.advanced.maxTokens')}>
            <NumberInput
              value={a.maxTokens}
              min={256}
              max={32000}
              step={256}
              fallback={4096}
              onChange={(val) => patch({ maxTokens: val ?? 4096 })}
            />
          </Field>
          <Field label={t('opt.advanced.temperature')} hint={t('opt.advanced.temperatureHint')}>
            <NumberInput
              value={a.temperature}
              min={0}
              max={2}
              step={0.1}
              fallback={null}
              placeholder={t('opt.advanced.temperaturePlaceholder')}
              onChange={(val) => patch({ temperature: val })}
            />
          </Field>
        </div>
        <div className="card-row">
          <Field label={t('opt.advanced.requestTimeout')}>
            <NumberInput
              value={Math.round(a.requestTimeoutMs / 1000)}
              min={30}
              max={600}
              step={10}
              fallback={180}
              onChange={(val) => patch({ requestTimeoutMs: (val ?? 180) * 1000 })}
            />
          </Field>
          <Field label={t('opt.advanced.maxRetries')} hint={t('opt.advanced.maxRetriesHint')}>
            <NumberInput
              value={a.maxRetries}
              min={0}
              max={6}
              fallback={2}
              onChange={(val) => patch({ maxRetries: val ?? 2 })}
            />
          </Field>
        </div>
      </div>

      <div className="card toggles">
        <Toggle
          checked={a.autoScreenshot}
          onChange={(v) => patch({ autoScreenshot: v })}
          label={t('opt.advanced.autoScreenshot')}
          hint={t('opt.advanced.autoScreenshotHint')}
        />
        <Toggle
          checked={a.setOfMarks}
          onChange={(v) => patch({ setOfMarks: v })}
          label={t('opt.advanced.setOfMarks')}
          hint={t('opt.advanced.setOfMarksHint')}
        />
        <Toggle
          checked={a.planning}
          onChange={(v) => patch({ planning: v })}
          label={t('opt.advanced.planning')}
          hint={t('opt.advanced.planningHint')}
        />
        <Toggle
          checked={a.enableJavascriptTool}
          onChange={(v) => patch({ enableJavascriptTool: v })}
          label={t('opt.advanced.enableJs')}
          hint={t('opt.advanced.enableJsHint')}
        />
      </div>

      {/* ⚡ System 1 极速决策引擎 (Jev / Laya) */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 8px 0' }}>{t('opt.system1.title')}</h2>
        <p className="hint" style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
          {t('opt.system1.lead')}
        </p>
        <Toggle
          checked={sys1.enabled}
          onChange={(v) => patchSys1({ enabled: v })}
          label={t('opt.system1.enable')}
          hint={t('opt.system1.enableHint')}
        />
        {sys1.enabled && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={t('opt.system1.provider')}>
              <select
                value={sys1.provider}
                onChange={(e) => {
                  const p = e.target.value as System1ProviderType;
                  if (p === 'typesafe') {
                    patchSys1({
                      provider: p,
                      baseUrl: 'https://api.typesafe.ai/v1',
                      model: 'jev',
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

            <div className="card-row">
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

            <div className="card-row">
              <Field label={t('opt.system1.model')}>
                <input
                  type="text"
                  value={sys1.model}
                  placeholder={sys1.provider === 'laya-local' ? 'laya-modernbert-large' : 'jev'}
                  onChange={(e) => patchSys1({ model: e.target.value })}
                />
              </Field>
              <Field label={t('opt.system1.minConfidence')}>
                <NumberInput
                  value={sys1.minConfidence}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  fallback={0.6}
                  onChange={(val) => patchSys1({ minConfidence: val ?? 0.6 })}
                />
              </Field>
              <Field label={t('opt.system1.maxFastSteps')}>
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
        )}
      </div>
    </div>
  );
}
