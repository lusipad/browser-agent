import { useState } from 'react';
import type { ModelConfig, ModelPricing, ProviderConfig } from '../../shared/types';
import { fetchRegistry, diffRegistry, type RegistryDiff } from '../../shared/registry';
import { useT } from '../../shared/i18nReact';
import { Field, Toggle, type PanelProps } from './common';

type FetchState = 'idle' | 'loading' | 'done' | 'error';

export function ModelsPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchError, setFetchError] = useState('');
  const [diff, setDiff] = useState<RegistryDiff | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState('');

  function patch(id: string, p: Partial<ModelConfig>) {
    const models = cfg.models.map((x) => {
      if (x.id !== id) return x;
      const merged = { ...x, ...p };
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

  async function handleFetch() {
    setFetchState('loading');
    setFetchError('');
    setDiff(null);
    setSelected(new Set());
    try {
      const registry = await fetchRegistry();
      const d = diffRegistry(registry, cfg.models, cfg.providers);
      setDiff(d);
      setUpdatedAt(registry.updatedAt || '');
      setSelected(new Set(d.newModels.map((m) => m.id)));
      setFetchState('done');
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setFetchState('error');
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function importSelected() {
    if (!diff) return;
    const toAdd = diff.newModels.filter((m) => selected.has(m.id));
    const toUpdate = diff.updatedModels.filter((u) => selected.has(u.remote.id));
    if (!toAdd.length && !toUpdate.length) return;

    const existingProviderIds = new Set(cfg.providers.map((p) => p.id));
    const newProviders: ProviderConfig[] = [];
    for (const m of toAdd) {
      if (!existingProviderIds.has(m.providerId)) {
        const rp = diff.newProviders.find((p) => p.id === m.providerId);
        if (rp && !newProviders.some((p) => p.id === rp.id)) {
          newProviders.push({ ...rp, apiKey: '' });
          existingProviderIds.add(rp.id);
        }
      }
    }

    let models = [...cfg.models, ...toAdd];
    for (const { remote } of toUpdate) {
      models = models.map((m) =>
        m.id === remote.id
          ? { ...m, contextWindow: remote.contextWindow, pricing: remote.pricing, vision: remote.vision }
          : m,
      );
    }

    onChange({
      ...cfg,
      providers: [...cfg.providers, ...newProviders],
      models,
    });

    setDiff(null);
    setFetchState('idle');
  }

  function dismissFetch() {
    setDiff(null);
    setFetchState('idle');
  }

  const hasChanges = diff && (diff.newModels.length > 0 || diff.updatedModels.length > 0);

  return (
    <div className="panel">
      <h1>{t('opt.models.title')}</h1>
      <p className="lead">{t('opt.models.lead')}</p>

      {/* Fetch registry */}
      <div className="registry-section">
        <div className="registry-bar">
          <button
            className="btn fetch-btn"
            onClick={handleFetch}
            disabled={fetchState === 'loading'}
          >
            {fetchState === 'loading' ? t('opt.models.fetching') : t('opt.models.fetchLatest')}
          </button>
          <span className="registry-hint">{t('opt.models.fetchHint')}</span>
        </div>

        {fetchState === 'error' && (
          <div className="registry-error">{t('opt.models.fetchFail', [fetchError])}</div>
        )}

        {fetchState === 'done' && diff && (
          <div className="registry-results card">
            <div className="registry-header">
              <span className="registry-title">
                {hasChanges
                  ? t('opt.models.fetchFound', [diff.newModels.length, diff.updatedModels.length])
                  : t('opt.models.fetchUpToDate')}
              </span>
              {updatedAt && <span className="registry-date">{t('opt.models.registryDate', [updatedAt])}</span>}
            </div>

            {diff.newModels.length > 0 && (
              <div className="registry-group">
                <div className="registry-group-title">{t('opt.models.newModelsLabel')}</div>
                {diff.newModels.map((m) => (
                  <label className="registry-item" key={m.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                    />
                    <div className="registry-item-info">
                      <span className="registry-item-label">{m.label}</span>
                      <span className="registry-item-meta">
                        {m.model}
                        {m.vision ? ' · vision' : ''}
                        {m.contextWindow ? ` · ${Math.round(m.contextWindow / 1000)}k` : ''}
                        {m.pricing
                          ? ` · $${m.pricing.input}/${m.pricing.output}`
                          : ''}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {diff.updatedModels.length > 0 && (
              <div className="registry-group">
                <div className="registry-group-title">{t('opt.models.updatedModelsLabel')}</div>
                {diff.updatedModels.map(({ remote, local }) => (
                  <label className="registry-item" key={remote.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(remote.id)}
                      onChange={() => toggleSelect(remote.id)}
                    />
                    <div className="registry-item-info">
                      <span className="registry-item-label">{remote.label}</span>
                      <span className="registry-item-meta">
                        {describeDelta(local, remote)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="registry-actions">
              {hasChanges && (
                <button
                  className="btn"
                  onClick={importSelected}
                  disabled={selected.size === 0}
                >
                  {t('opt.models.importSelected', [selected.size])}
                </button>
              )}
              <button className="btn" onClick={dismissFetch}>
                {t('opt.models.dismiss')}
              </button>
            </div>
          </div>
        )}
      </div>

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

function describeDelta(local: ModelConfig, remote: ModelConfig): string {
  const parts: string[] = [];
  if (remote.pricing?.input !== local.pricing?.input || remote.pricing?.output !== local.pricing?.output) {
    const from = local.pricing ? `$${local.pricing.input}/${local.pricing.output}` : '-';
    const to = remote.pricing ? `$${remote.pricing.input}/${remote.pricing.output}` : '-';
    parts.push(`${from} → ${to}`);
  }
  if (remote.contextWindow !== local.contextWindow) {
    const from = local.contextWindow ? `${Math.round(local.contextWindow / 1000)}k` : '-';
    const to = remote.contextWindow ? `${Math.round(remote.contextWindow / 1000)}k` : '-';
    parts.push(`ctx ${from} → ${to}`);
  }
  if (remote.vision !== local.vision) {
    parts.push(`vision ${local.vision ? 'on' : 'off'} → ${remote.vision ? 'on' : 'off'}`);
  }
  return parts.join(' · ');
}
