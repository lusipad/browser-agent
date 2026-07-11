import type { ModelConfig } from '../../shared/types';
import { Field, Toggle, type PanelProps } from './common';

export function ModelsPanel({ cfg, onChange }: PanelProps) {
  function patch(id: string, p: Partial<ModelConfig>) {
    const models = cfg.models.map((x) => {
      if (x.id !== id) return x;
      const merged = { ...x, ...p };
      // id 始终跟随 providerId/model 派生，保证唯一且稳定
      merged.id = `${merged.providerId}/${merged.model}`;
      return merged;
    });
    const newId = models.find((_, i) => cfg.models[i]?.id === id)?.id ?? cfg.defaultModelId;
    const defaultModelId = cfg.defaultModelId === id ? newId : cfg.defaultModelId;
    onChange({ ...cfg, models, defaultModelId });
  }

  function add() {
    const prov = cfg.providers[0];
    if (!prov) {
      alert('请先在「服务商」页添加一个服务商。');
      return;
    }
    const model = 'new-model';
    const id = `${prov.id}/${model}`;
    if (cfg.models.some((m) => m.id === id)) return;
    onChange({
      ...cfg,
      models: [...cfg.models, { id, providerId: prov.id, model, label: '新模型', vision: true }],
    });
  }

  function remove(id: string) {
    const models = cfg.models.filter((x) => x.id !== id);
    if (!models.length) {
      alert('至少保留一个模型。');
      return;
    }
    const defaultModelId = cfg.defaultModelId === id ? models[0].id : cfg.defaultModelId;
    onChange({ ...cfg, models, defaultModelId });
  }

  return (
    <div className="panel">
      <h1>模型</h1>
      <p className="lead">
        为每个模型选择所属服务商，并填写传给接口的模型名。
        <b>视觉</b>开关关闭时，该模型不会收到截图，改用文本方式感知页面（适合 DeepSeek 等纯文本模型）。
      </p>

      {cfg.models.map((m) => (
        <div className="card" key={m.id}>
          <div className="card-row">
            <Field label="显示名称">
              <input value={m.label} onChange={(e) => patch(m.id, { label: e.target.value })} />
            </Field>
            <Field label="服务商">
              <select value={m.providerId} onChange={(e) => patch(m.id, { providerId: e.target.value })}>
                {cfg.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="card-row">
            <Field label="模型名（传给 API）" hint="例如 gpt-5.6、deepseek-v4-flash">
              <input value={m.model} spellCheck={false} onChange={(e) => patch(m.id, { model: e.target.value })} />
            </Field>
            <div className="field vision-toggle">
              <Toggle checked={m.vision} onChange={(v) => patch(m.id, { vision: v })} label="支持视觉（截图）" />
            </div>
          </div>
          <div className="card-actions">
            <label className="default-radio">
              <input
                type="radio"
                name="default-model"
                checked={cfg.defaultModelId === m.id}
                onChange={() => onChange({ ...cfg, defaultModelId: m.id })}
              />
              设为默认
            </label>
            <span className="spacer" />
            <button className="btn danger" onClick={() => remove(m.id)}>
              删除
            </button>
          </div>
        </div>
      ))}

      <button className="btn add" onClick={add}>
        + 添加模型
      </button>
    </div>
  );
}
