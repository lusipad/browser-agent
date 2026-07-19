import { formatUsd } from '../../shared/context';
import type { ModelPick, TimelineItem } from '../../shared/types';
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
  onModel: (id: string) => void;
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
  const { usage } = props;
  const cur = props.models.find((m) => m.id === props.modelId);
  const hasUsage = usage.input + usage.output > 0;
  const pct =
    usage.contextTokens && usage.contextBudget ? Math.min(1, usage.contextTokens / usage.contextBudget) : 0;

  const usageTitle =
    `输入 ${usage.input.toLocaleString()} · 输出 ${usage.output.toLocaleString()} tokens` +
    (usage.cost != null ? `\n累计成本 ${formatUsd(usage.cost)}（按当前模型计费）` : '\n当前模型未配置计费，无法估算成本') +
    (pct ? `\n上下文占用 ${fmt(usage.contextTokens)} / ${fmt(usage.contextBudget)}（${Math.round(pct * 100)}%）` : '');

  return (
    <header className="header">
      <div className="brand">
        <span className="logo" />
        <div className="model-wrap">
          <select
            className="model-select"
            value={props.modelId}
            disabled={props.running}
            onChange={(e) => props.onModel(e.target.value)}
            title={cur ? `${cur.providerName} · ${cur.vision ? '支持视觉' : '无视觉'}` : '选择模型'}
          >
            {!props.models.length && <option value="">未配置模型 →请打开设置</option>}
            {props.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.vision ? '' : ' 〔无视觉〕'}
              </option>
            ))}
          </select>
          {cur && (
            <span className="model-meta">
              {cur.providerName}
              {!cur.vision && ' · 无视觉'}
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
        <button className="icon-btn" title="会话历史" onClick={props.onHistory}>
          🕘
        </button>
        <button className="icon-btn" title="释放浏览器控制" onClick={props.onDetach}>
          ⏏
        </button>
        <button className="icon-btn" title="新对话" onClick={props.onNewChat} disabled={props.running}>
          ✎
        </button>
        <button className="icon-btn" title="设置" onClick={props.onOptions}>
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
