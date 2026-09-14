import { useEffect, useState } from 'react';
import type { AdvancedSettings } from '../../shared/types';
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
  function patch(p: Partial<AdvancedSettings>) {
    onChange({ ...cfg, advanced: { ...a, ...p } });
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
              max={100}
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
    </div>
  );
}
