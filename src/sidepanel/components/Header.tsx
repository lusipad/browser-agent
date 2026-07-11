import type { ModelPick } from '../../shared/types';

interface Props {
  models: ModelPick[];
  modelId: string;
  usage: { input: number; output: number };
  running: boolean;
  onModel: (id: string) => void;
  onNewChat: () => void;
  onOptions: () => void;
  onDetach: () => void;
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function Header(props: Props) {
  const cur = props.models.find((m) => m.id === props.modelId);
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
        {props.usage.input + props.usage.output > 0 && (
          <span className="usage" title="本会话累计 token">
            ↑{fmt(props.usage.input)} ↓{fmt(props.usage.output)}
          </span>
        )}
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
    </header>
  );
}
