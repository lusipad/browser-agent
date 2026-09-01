import { formatUsd } from '../../shared/context';
import type { ModelPick, TimelineItem } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { ExportMenu } from './ExportMenu';

interface Usage {
  input: number;
  output: number;
  cost: number | null;
  contextTokens?: number;
  contextBudget?: number;
}

interface Props {
  models: ModelPick[];
  modelId: string;
  usage: Usage;
  running: boolean;
  items: TimelineItem[];
  /** 会话级视觉覆盖（null=跟随模型，false=关闭，true=强制开启） */
  visionOverride: boolean | null;
  onModel: (id: string) => void;
  onVision: (enabled: boolean) => void;
  onNewChat: () => void;
  onHistory: () => void;
  onOptions: () => void;
  onDetach: () => void;
}

function fmt(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(n);
}

/** 上下文占用条的颜色随占用升高：绿 → 橙 → 红 */
function meterColor(pct: number): string {
  if (pct >= 0.9) return '#e5484d';
  if (pct >= 0.7) return '#f5a623';
  return '#3fb950';
}

export function Header(props: Props) {
  const t = useT();
  const { usage } = props;
  const cur = props.models.find((m) => m.id === props.modelId);
  const hasUsage = usage.input + usage.output > 0;
  const pct =
    usage.contextTokens && usage.contextBudget ? Math.min(1, usage.contextTokens / usage.contextBudget) : 0;
  const visionOn = props.visionOverride ?? cur?.vision ?? false;
  const visionTitle = t('header.visionUse') + (cur && !cur.vision && visionOn ? '\n' + t('header.visionForce') : '');

  const usageTitle =
    t('header.usageDetail', [usage.input.toLocaleString(), usage.output.toLocaleString()]) +
    '\n' +
    (usage.cost != null ? t('header.costTitle', [formatUsd(usage.cost)]) : t('header.noPricing')) +
    (pct ? '\n' + t('header.ctxUsage', [fmt(usage.contextTokens), fmt(usage.contextBudget), Math.round(pct * 100)]) : '');

  return (
    <header className="header">
      <div className="brand">
        <span className="logo" />
        <div className="model-wrap">
          <div className="model-row">
            <select
              className="model-select"
              value={props.modelId}
              disabled={props.running}
              onChange={(e) => props.onModel(e.target.value)}
              title={cur ? `${cur.providerName} · ${cur.vision ? t('header.vision') : t('header.noVision')}` : t('header.model')}
            >
              {!props.models.length && <option value="">{t('header.noModel')}</option>}
              {props.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.vision ? '' : ` 〔${t('header.noVision')}〕`}
                </option>
              ))}
            </select>
            {cur && (
              <button
                className={`vision-btn${visionOn ? ' on' : ''}`}
                disabled={props.running}
                title={visionTitle}
                onClick={() => props.onVision(!visionOn)}
              >
                {visionOn ? t('header.visionOn') : t('header.visionOff')}
              </button>
            )}
          </div>
          {cur && (
            <span className="model-meta">
              {cur.providerName}
              {!cur.vision && ` · ${t('header.noVision')}`}
            </span>
          )}
        </div>
      </div>
      <div className="actions">
        {hasUsage && (
          <span className="usage" title={usageTitle}>
            {usage.cost != null ? (
              <>
                <b>{formatUsd(usage.cost)}</b>
                <span className="usage-tok">
                  {' '}
                  ↑{fmt(usage.input)} ↓{fmt(usage.output)}
                </span>
              </>
            ) : (
              <>
                ↑{fmt(usage.input)} ↓{fmt(usage.output)}
              </>
            )}
          </span>
        )}
        <ExportMenu
          items={props.items}
          meta={{ modelLabel: cur?.label ?? props.modelId, usage }}
        />
        <button className="icon-btn" title={t('header.history')} onClick={props.onHistory}>
          🕘
        </button>
        <button className="icon-btn" title={t('header.detach')} onClick={props.onDetach}>
          ⏏
        </button>
        <button className="icon-btn" title={t('header.newChat')} onClick={props.onNewChat} disabled={props.running}>
          ✎
        </button>
        <button className="icon-btn" title={t('header.settings')} onClick={props.onOptions}>
          ⚙
        </button>
      </div>
      {pct > 0 && (
        <div className="ctx-meter" title={usageTitle}>
          <span style={{ width: `${Math.round(pct * 100)}%`, background: meterColor(pct) }} />
        </div>
      )}
    </header>
  );
}
