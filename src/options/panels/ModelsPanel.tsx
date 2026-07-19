import type { ModelConfig, ModelPricing } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { Field, Toggle, type PanelProps } from './common';

export function ModelsPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
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

  function patchContext(id: string, v: string) {
    const n = Math.floor(Number(v));
    patch(id, { contextWindow: v.trim() === '' || !Number.isFinite(n) || n <= 0 ? undefined : n });
  }

  function patchPrice(id: string, key: keyof ModelPricing, v: string, cur: ModelPricing | undefined) {
    const val = v.trim() === '' ? 0 : Math.max(0, Number(v) || 0);
    const next: ModelPricing = { input: cur?.input ?? 0, output: cur?.output ?? 0, [key]: val };
    patch(id, { pricing: next.input > 0 || next.output > 0 ? next : undefined });
  }

  function add() {
    const prov = cfg.providers[0];
    if (!prov) {
      alert(t('opt.models.addProviderFirst'));
      return;
    }
    const model = 'new-model';
    const id = `${prov.id}/${model}`;
    if (cfg.models.some((m) => m.id === id)) return;
    onChange({
      ...cfg,
      models: [...cfg.models, { id, providerId: prov.id, model, label: t('opt.models.newLabel'), vision: true }],
    });
  }

  function remove(id: string) {
    const models = cfg.models.filter((x) => x.id !== id);
    if (!models.length) {
      alert(t('opt.models.keepOne'));
      return;
    }
    const defaultModelId = cfg.defaultModelId === id ? models[0].id : cfg.defaultModelId;
    onChange({ ...cfg, models, defaultModelId });
  }

  return (
    <div className="panel">
      <h1>{t('opt.models.title')}</h1>
      <p className="lead">{t('opt.models.lead')}</p>

      {cfg.models.map((m) => (
        <div className="card" key={m.id}>
          <div className="card-row">
            <Field label={t('opt.models.label')}>
              <input value={m.label} onChange={(e) => patch(m.id, { label: e.target.value })} />
            </Field>
            <Field label={t('opt.models.provider')}>
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
            <Field label={t('opt.models.modelName')} hint={t('opt.models.modelNameHint')}>
              <input value={m.model} spellCheck={false} onChange={(e) => patch(m.id, { model: e.target.value })} />
            </Field>
            <div className="field vision-toggle">
              <Toggle checked={m.vision} onChange={(v) => patch(m.id, { vision: v })} label={t('opt.models.vision')} />
            </div>
          </div>
          <div className="card-row">
            <Field label={t('opt.models.contextWindow')} hint={t('opt.models.contextWindowHint')}>
              <input
                type="number"
                min={0}
                step={1000}
                placeholder={t('opt.models.contextPlaceholder')}
                value={m.contextWindow ?? ''}
                onChange={(e) => patchContext(m.id, e.target.value)}
              />
            </Field>
            <Field label={t('opt.models.pricing')} hint={t('opt.models.pricingHint')}>
              <div className="price-inputs">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={t('opt.models.priceInput')}
                  value={m.pricing?.input ?? ''}
                  onChange={(e) => patchPrice(m.id, 'input', e.target.value, m.pricing)}
                />
                <span className="price-sep">/</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={t('opt.models.priceOutput')}
                  value={m.pricing?.output ?? ''}
                  onChange={(e) => patchPrice(m.id, 'output', e.target.value, m.pricing)}
                />
              </div>
            </Field>
          </div>
          <div className="card-actions">
            <label className="default-radio">
              <input
                type="radio"
                name="default-model"
                checked={cfg.defaultModelId === m.id}
                onChange={() => onChange({ ...cfg, defaultModelId: m.id })}
              />
              {t('opt.models.setDefault')}
            </label>
            <span className="spacer" />
            <button className="btn danger" onClick={() => remove(m.id)}>
              {t('opt.common.delete')}
            </button>
          </div>
        </div>
      ))}

      <button className="btn add" onClick={add}>
        {t('opt.models.add')}
      </button>
    </div>
  );
}
