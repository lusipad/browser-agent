import type { AdvancedSettings } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { Field, NumberInput, Toggle, type PanelProps } from './common';

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

      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>WebBridge 桌面反向网桥</h3>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
          允许本地 CLI 工具、IDE 插件或 MCP 伴侣通过 WebSocket 双向反向连接控制浏览器智能体。
        </p>
        <Toggle
          checked={cfg.webbridge?.enabled ?? false}
          onChange={(v) =>
            onChange({
              ...cfg,
              webbridge: {
                ...cfg.webbridge,
                enabled: v,
                url: cfg.webbridge?.url || 'ws://127.0.0.1:10086/ws',
              },
            })
          }
          label="启用 WebBridge 本地反向连接"
          hint="开启后将自动反向连接本地桌面守护进程 (支持 4409 实例冲突保护)"
        />
        {cfg.webbridge?.enabled && (
          <div style={{ marginTop: '12px' }}>
            <Field label="WebSocket 守护端点" hint="本地 WebSocket 服务地址，如 ws://127.0.0.1:10086/ws">
              <input
                type="text"
                value={cfg.webbridge?.url || 'ws://127.0.0.1:10086/ws'}
                onChange={(e) =>
                  onChange({
                    ...cfg,
                    webbridge: {
                      ...cfg.webbridge,
                      enabled: true,
                      url: e.target.value,
                    },
                  })
                }
                placeholder="ws://127.0.0.1:10086/ws"
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
