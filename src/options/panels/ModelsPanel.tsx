import { useState } from 'react';
import type { ModelBinding, ModelConfig, ModelPricing } from '../../shared/types';
import { fetchRegistry, diffRegistryMetadata, type RegistryMetadataDiff } from '../../shared/registry';
import { uid } from '../../shared/util';
import { useT } from '../../shared/i18nReact';
import { Field, Toggle, type PanelProps } from './common';

type FetchState = 'idle' | 'loading' | 'done' | 'error';

const bindingKey = (id: string) => `binding:${id}`;
const modelKey = (id: string) => `model:${id}`;

export function ModelsPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchError, setFetchError] = useState('');
  const [diff, setDiff] = useState<RegistryMetadataDiff | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState('');

  function patchModel(id: string, p: Partial<ModelConfig>) {
    onChange({ ...cfg, models: cfg.models.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  }

  function patchBinding(id: string, p: Partial<ModelBinding>) {
    onChange({ ...cfg, bindings: cfg.bindings.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  }

  function patchContext(modelId: string, v: string) {
    const n = Math.floor(Number(v));
    patchModel(modelId, { contextWindow: v.trim() === '' || !Number.isFinite(n) || n <= 0 ? undefined : n });
  }

  function patchPrice(bindingId: string, key: keyof ModelPricing, v: string, cur: ModelPricing | undefined) {
    const val = v.trim() === '' ? 0 : Math.max(0, Number(v) || 0);
    const next: ModelPricing = { input: cur?.input ?? 0, output: cur?.output ?? 0, [key]: val };
    patchBinding(bindingId, { pricing: next.input > 0 || next.output > 0 ? next : undefined });
  }

  function add() {
    const provider = cfg.providers[0];
    if (!provider) {
      alert(t('opt.models.addProviderFirst'));
      return;
    }
    const modelId = uid('model');
    const bindingId = uid('binding');
    onChange({
      ...cfg,
      models: [...cfg.models, { id: modelId, label: t('opt.models.newLabel'), vision: true }],
      bindings: [...cfg.bindings, { id: bindingId, modelId, providerId: provider.id, apiModelName: 'new-model', enabled: true }],
    });
  }

  function remove(bindingId: string) {
    if (cfg.bindings.length === 1) {
      alert(t('opt.models.keepOne'));
      return;
    }
    const bindings = cfg.bindings.filter((b) => b.id !== bindingId);
    const removedModelId = cfg.bindings.find((b) => b.id === bindingId)?.modelId;
    const models = removedModelId && !bindings.some((b) => b.modelId === removedModelId)
      ? cfg.models.filter((m) => m.id !== removedModelId)
      : cfg.models;
    const defaultBindingId = cfg.defaultBindingId === bindingId
      ? bindings.find((b) => b.enabled !== false)?.id ?? bindings[0].id
      : cfg.defaultBindingId;
    onChange({ ...cfg, models, bindings, defaultBindingId });
  }

  async function handleFetch() {
    setFetchState('loading');
    setFetchError('');
    setDiff(null);
    setSelected(new Set());
    try {
      const registry = await fetchRegistry();
      const d = diffRegistryMetadata(registry, cfg.models, cfg.bindings);
      setDiff(d);
      setUpdatedAt(registry.updatedAt || '');
      setSelected(new Set([
        ...d.updatedBindings.map(({ local }) => bindingKey(local.id)),
        ...d.updatedModels.map(({ local }) => modelKey(local.id)),
      ]));
      setFetchState('done');
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setFetchState('error');
    }
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateSelected() {
    if (!diff) return;
    const toUpdateModels = diff.updatedModels.filter(({ local }) => selected.has(modelKey(local.id)));
    const toUpdateBindings = diff.updatedBindings.filter(({ local }) => selected.has(bindingKey(local.id)));
    if (!toUpdateModels.length && !toUpdateBindings.length) return;

    let models = cfg.models;
    for (const { remote, local } of toUpdateModels) {
      models = models.map((m) => (m.id === local.id ? { ...m, label: remote.label, contextWindow: remote.contextWindow, vision: remote.vision } : m));
    }
    let bindings = cfg.bindings;
    for (const { remote, local } of toUpdateBindings) {
      bindings = bindings.map((b) => (b.id === local.id ? { ...b, pricing: remote.pricing } : b));
    }

    onChange({ ...cfg, models, bindings });
    setDiff(null);
    setFetchState('idle');
  }

  function dismissFetch() {
    setDiff(null);
    setFetchState('idle');
  }

  const hasChanges = !!diff && (
    diff.updatedModels.length > 0 ||
    diff.updatedBindings.length > 0
  );

  return (
    <div className="panel">
      <h1>{t('opt.models.title')}</h1>
      <p className="lead">{t('opt.models.lead')}</p>

      <div className="registry-section">
        <div className="registry-bar">
          <button className="btn fetch-btn" onClick={handleFetch} disabled={fetchState === 'loading'}>
            {fetchState === 'loading' ? t('opt.models.fetching') : t('opt.models.fetchLatest')}
          </button>
          <span className="registry-hint">{t('opt.models.fetchHint')}</span>
        </div>

        {fetchState === 'error' && <div className="registry-error">{t('opt.models.fetchFail', [fetchError])}</div>}

        {fetchState === 'done' && diff && (
          <div className="registry-results card">
            <div className="registry-header">
              <span className="registry-title">
                {hasChanges
                  ? t('opt.models.fetchFound', [diff.updatedModels.length, diff.updatedBindings.length])
                  : t('opt.models.fetchUpToDate')}
              </span>
              {updatedAt && <span className="registry-date">{t('opt.models.registryDate', [updatedAt])}</span>}
            </div>

            {(diff.updatedBindings.length > 0 || diff.updatedModels.length > 0) && (
              <div className="registry-group">
                <div className="registry-group-title">{t('opt.models.updatedModelsLabel')}</div>
                {diff.updatedModels.map(({ remote, local }) => (
                  <label className="registry-item" key={modelKey(local.id)}>
                    <input type="checkbox" checked={selected.has(modelKey(local.id))} onChange={() => toggleSelect(modelKey(local.id))} />
                    <div className="registry-item-info">
                      <span className="registry-item-label">{local.label}</span>
                      <span className="registry-item-meta">{describeModelDelta(local, remote)}</span>
                    </div>
                  </label>
                ))}
                {diff.updatedBindings.map(({ remote, local }) => (
                  <label className="registry-item" key={bindingKey(local.id)}>
                    <input type="checkbox" checked={selected.has(bindingKey(local.id))} onChange={() => toggleSelect(bindingKey(local.id))} />
                    <div className="registry-item-info">
                      <span className="registry-item-label">{cfg.models.find((m) => m.id === local.modelId)?.label ?? local.apiModelName}</span>
                      <span className="registry-item-meta">{describeBindingDelta(local, remote)}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="registry-actions">
              {hasChanges && <button className="btn" onClick={updateSelected} disabled={selected.size === 0}>{t('opt.models.updateSelected', [selected.size])}</button>}
              <button className="btn" onClick={dismissFetch}>{t('opt.models.dismiss')}</button>
            </div>
          </div>
        )}
      </div>

      {cfg.bindings.map((binding) => {
        const model = cfg.models.find((m) => m.id === binding.modelId);
        if (!model) return null;
        return (
          <div className="card" key={binding.id}>
            <div className="card-row">
              <Field label={t('opt.models.model')}>
                <input value={model.label} onChange={(e) => patchModel(model.id, { label: e.target.value })} />
              </Field>
              <Field label={t('opt.models.provider')}>
                <select value={binding.providerId} onChange={(e) => patchBinding(binding.id, { providerId: e.target.value })}>
                  {cfg.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="card-row">
              <Field label={t('opt.models.modelName')} hint={t('opt.models.modelNameHint')}>
                <input value={binding.apiModelName} spellCheck={false} onChange={(e) => patchBinding(binding.id, { apiModelName: e.target.value })} />
              </Field>
              <div className="field vision-toggle">
                <Toggle checked={model.vision} onChange={(v) => patchModel(model.id, { vision: v })} label={t('opt.models.vision')} />
              </div>
            </div>
            <div className="card-row">
              <Field label={t('opt.models.contextWindow')} hint={t('opt.models.contextWindowHint')}>
                <input type="number" min={0} step={1000} placeholder={t('opt.models.contextPlaceholder')} value={model.contextWindow ?? ''} onChange={(e) => patchContext(model.id, e.target.value)} />
              </Field>
              <Field label={t('opt.models.pricing')} hint={t('opt.models.pricingHint')}>
                <div className="price-inputs">
                  <input type="number" min={0} step={0.01} placeholder={t('opt.models.priceInput')} value={binding.pricing?.input ?? ''} onChange={(e) => patchPrice(binding.id, 'input', e.target.value, binding.pricing)} />
                  <span className="price-sep">/</span>
                  <input type="number" min={0} step={0.01} placeholder={t('opt.models.priceOutput')} value={binding.pricing?.output ?? ''} onChange={(e) => patchPrice(binding.id, 'output', e.target.value, binding.pricing)} />
                </div>
              </Field>
            </div>
            <div className="card-actions">
              <label className="default-radio">
                <input type="radio" name="default-binding" checked={cfg.defaultBindingId === binding.id} disabled={binding.enabled === false} onChange={() => onChange({ ...cfg, defaultBindingId: binding.id })} />
                {t('opt.models.setDefault')}
              </label>
              <span className={'binding-state' + (binding.enabled === false ? ' disabled' : '')}>
                {binding.enabled === false ? t('opt.providers.disabled') : t('opt.providers.enabled')}
              </span>
              <span className="spacer" />
              <button className="btn danger" onClick={() => remove(binding.id)}>{t('opt.common.delete')}</button>
            </div>
          </div>
        );
      })}

      <button className="btn add" onClick={add}>{t('opt.models.add')}</button>
    </div>
  );
}

function describeModelDelta(local: ModelConfig, remote: ModelConfig): string {
  const parts: string[] = [];
  if (remote.contextWindow !== local.contextWindow) {
    const from = local.contextWindow ? `${Math.round(local.contextWindow / 1000)}k` : '-';
    const to = remote.contextWindow ? `${Math.round(remote.contextWindow / 1000)}k` : '-';
    parts.push(`ctx ${from} → ${to}`);
  }
  if (remote.vision !== local.vision) parts.push(`vision ${local.vision ? 'on' : 'off'} → ${remote.vision ? 'on' : 'off'}`);
  if (remote.label !== local.label) parts.push(`${local.label} → ${remote.label}`);
  return parts.join(' · ');
}

function describeBindingDelta(local: ModelBinding, remote: ModelBinding): string {
  const parts: string[] = [];
  if (remote.apiModelName !== local.apiModelName) parts.push(`${local.apiModelName} → ${remote.apiModelName}`);
  if (remote.pricing?.input !== local.pricing?.input || remote.pricing?.output !== local.pricing?.output) {
    const from = local.pricing ? `$${local.pricing.input}/${local.pricing.output}` : '-';
    const to = remote.pricing ? `$${remote.pricing.input}/${remote.pricing.output}` : '-';
    parts.push(`${from} → ${to}`);
  }
  return parts.join(' · ');
}
