import type { AdvancedSettings } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { Field, Toggle, type PanelProps } from './common';

export function AdvancedPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const a = cfg.advanced;
  function patch(p: Partial<AdvancedSettings>) {
    onChange({ ...cfg, advanced: { ...a, ...p } });
  }
  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

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
            <input
              type="number"
              value={a.maxIterations}
              min={1}
              max={100}
              onChange={(e) => patch({ maxIterations: num(e.target.value, 1, 100, 24) })}
            />
          </Field>
          <Field label={t('opt.advanced.maxImagesKept')} hint={t('opt.advanced.maxImagesKeptHint')}>
            <input
              type="number"
              value={a.maxImagesKept}
              min={0}
              max={20}
              onChange={(e) => patch({ maxImagesKept: num(e.target.value, 0, 20, 4) })}
            />
          </Field>
        </div>
        <Field label={t('opt.advanced.maxContextTokens')} hint={t('opt.advanced.maxContextTokensHint')}>
          <input
            type="number"
            value={a.maxContextTokens}
            min={8000}
            max={1000000}
            step={4000}
            onChange={(e) => patch({ maxContextTokens: num(e.target.value, 8000, 1000000, 96000) })}
          />
        </Field>
        <div className="card-row">
          <Field label={t('opt.advanced.screenshotMaxWidth')} hint={t('opt.advanced.screenshotMaxWidthHint')}>
            <input
              type="number"
              value={a.screenshotMaxWidth}
              min={640}
              max={2560}
              step={64}
              onChange={(e) => patch({ screenshotMaxWidth: num(e.target.value, 640, 2560, 1366) })}
            />
          </Field>
          <Field label={t('opt.advanced.jpegQuality')}>
            <input
              type="number"
              value={a.jpegQuality}
              min={30}
              max={100}
              onChange={(e) => patch({ jpegQuality: num(e.target.value, 30, 100, 80) })}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <Field label={t('opt.advanced.maxTokens')}>
            <input
              type="number"
              value={a.maxTokens}
              min={256}
              max={32000}
              step={256}
              onChange={(e) => patch({ maxTokens: num(e.target.value, 256, 32000, 4096) })}
            />
          </Field>
          <Field label={t('opt.advanced.temperature')} hint={t('opt.advanced.temperatureHint')}>
            <input
              type="number"
              value={a.temperature ?? ''}
              min={0}
              max={2}
              step={0.1}
              placeholder={t('opt.advanced.temperaturePlaceholder')}
              onChange={(e) => patch({ temperature: e.target.value === '' ? null : num(e.target.value, 0, 2, 0) })}
            />
          </Field>
        </div>
        <div className="card-row">
          <Field label={t('opt.advanced.requestTimeout')}>
            <input
              type="number"
              value={Math.round(a.requestTimeoutMs / 1000)}
              min={30}
              max={600}
              step={10}
              onChange={(e) => patch({ requestTimeoutMs: num(e.target.value, 30, 600, 180) * 1000 })}
            />
          </Field>
          <Field label={t('opt.advanced.maxRetries')} hint={t('opt.advanced.maxRetriesHint')}>
            <input
              type="number"
              value={a.maxRetries}
              min={0}
              max={6}
              onChange={(e) => patch({ maxRetries: num(e.target.value, 0, 6, 2) })}
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
