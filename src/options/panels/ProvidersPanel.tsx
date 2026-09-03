import { useState } from 'react';
import type { DiscoveredModel, ModelBinding, ModelConfig, ProviderConfig } from '../../shared/types';
import { discoverEndpointModels } from '../../shared/registry';
import { uid } from '../../shared/util';
import { useT } from '../../shared/i18nReact';
import { Field, type PanelProps } from './common';

type DiscoveryState = 'idle' | 'loading' | 'done' | 'error';
type Discovery = {
  state: DiscoveryState;
  models: DiscoveredModel[];
  selected: Set<string>;
  message?: string;
};

export function unavailableModelNames(bindings: ModelBinding[], providerId: string, available: unknown): string[] {
  if (!Array.isArray(available)) return [];
  const ids = new Set(
    available
      .map((item) => typeof item === 'string' ? item : (item as DiscoveredModel)?.id)
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.toLowerCase()),
  );
  return bindings
    .filter((b) => b.providerId === providerId && !ids.has(b.apiModelName.toLowerCase()))
    .map((b) => b.apiModelName);
}

export function discoveredModelStatus(
  model: DiscoveredModel,
  bindings: ModelBinding[],
  providerId: string,
): 'new' | 'configured' {
  return bindings.some(
    (b) => b.providerId === providerId && b.apiModelName.toLowerCase() === model.id.toLowerCase(),
  ) ? 'configured' : 'new';
}

export function ProvidersPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const [testing, setTesting] = useState<Record<string, string>>({});
  const [discovery, setDiscovery] = useState<Record<string, Discovery>>({});
  const [selections, setSelections] = useState<Record<string, boolean>>({});

  function patch(id: string, p: Partial<ProviderConfig>) {
    onChange({ ...cfg, providers: cfg.providers.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  }

  function add() {
    const id = uid('prov');
    onChange({
      ...cfg,
      providers: [...cfg.providers, { id, name: t('opt.providers.newName'), baseUrl: 'https://', apiKey: '' }],
    });
  }

  function remove(id: string) {
    if (cfg.bindings.some((b) => b.providerId === id)) {
      alert(t('opt.providers.hasModels'));
      return;
    }
    onChange({ ...cfg, providers: cfg.providers.filter((x) => x.id !== id) });
  }

  async function discover(p: ProviderConfig) {
    setDiscovery((prev) => ({
      ...prev,
      [p.id]: { state: 'loading', models: [], selected: new Set() },
    }));
    try {
      const models = await discoverEndpointModels(p);
      const selected = new Set(
        models
          .filter((model) => discoveredModelStatus(model, cfg.bindings, p.id) === 'new')
          .map((model) => model.id),
      );
      setDiscovery((prev) => ({ ...prev, [p.id]: { state: 'done', models, selected } }));
      setTesting((prev) => ({ ...prev, [p.id]: t('opt.providers.testOkN', [models.length]) }));
    } catch (e) {
      const message = e instanceof Error ? e.message : t('opt.providers.testFail');
      setDiscovery((prev) => ({ ...prev, [p.id]: { state: 'error', models: [], selected: new Set(), message } }));
      setTesting((prev) => ({ ...prev, [p.id]: `✗ ${message}` }));
    }
  }

  function toggleDiscovered(providerId: string, modelId: string) {
    setDiscovery((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      const selected = new Set(current.selected);
      if (selected.has(modelId)) selected.delete(modelId);
      else selected.add(modelId);
      return { ...prev, [providerId]: { ...current, selected } };
    });
  }

  function importSelected(p: ProviderConfig) {
    const current = discovery[p.id];
    if (!current) return;
    const existing = new Set(
      cfg.bindings
        .filter((b) => b.providerId === p.id)
        .map((b) => b.apiModelName.toLowerCase()),
    );
    const selected = current.models.filter((model) => current.selected.has(model.id) && !existing.has(model.id.toLowerCase()));
    if (!selected.length) return;

    const modelByKey = new Map(cfg.models.map((model) => [model.id.toLowerCase(), model]));
    const newModels: ModelConfig[] = [];
    const newBindings: ModelBinding[] = [];
    for (const discovered of selected) {
      const key = discovered.id.toLowerCase();
      const model = modelByKey.get(key) ?? {
        id: discovered.id,
        label: discovered.id,
        vision: false,
      };
      if (!modelByKey.has(key)) {
        modelByKey.set(key, model);
        newModels.push(model);
      }
      newBindings.push({
        id: uid(`binding-${p.id}`),
        modelId: model.id,
        providerId: p.id,
        apiModelName: discovered.id,
        enabled: true,
      });
    }
    onChange({ ...cfg, models: [...cfg.models, ...newModels], bindings: [...cfg.bindings, ...newBindings] });
    const imported = new Set(selected.map((model) => model.id));
    setDiscovery((prev) => ({
      ...prev,
      [p.id]: { ...current, selected: new Set([...current.selected].filter((id) => !imported.has(id))) },
    }));
  }

  function setEnabled(bindingId: string, enabled: boolean) {
    if (!enabled && cfg.bindings.filter((b) => b.enabled !== false).length <= 1) {
      alert(t('opt.providers.keepOneEnabled'));
      return;
    }
    const bindings = cfg.bindings.map((b) => (b.id === bindingId ? { ...b, enabled } : b));
    const defaultBindingId =
      enabled || cfg.defaultBindingId !== bindingId
        ? cfg.defaultBindingId
        : bindings.find((b) => b.enabled !== false)?.id ?? cfg.defaultBindingId;
    onChange({ ...cfg, bindings, defaultBindingId });
  }

  function selectedBindingIds(providerId: string): Set<string> {
    return new Set(
      cfg.bindings
        .filter((binding) => binding.providerId === providerId)
        .filter((binding) => selections[bindingSelectionKey(providerId, binding.id)])
        .map((binding) => binding.id),
    );
  }

  function batchSetEnabled(p: ProviderConfig, enabled: boolean) {
    const ids = selectedBindingIds(p.id);
    if (!enabled) {
      const remaining = cfg.bindings.filter((b) => b.enabled !== false && !ids.has(b.id));
      if (!remaining.length) {
        alert(t('opt.providers.keepOneEnabled'));
        return;
      }
    }
    const bindings = cfg.bindings.map((b) => ids.has(b.id) ? { ...b, enabled } : b);
    const defaultBindingId =
      bindings.find((b) => b.id === cfg.defaultBindingId && b.enabled !== false)?.id ??
      bindings.find((b) => b.enabled !== false)?.id ??
      cfg.defaultBindingId;
    onChange({ ...cfg, bindings, defaultBindingId });
  }

  function batchDelete(p: ProviderConfig) {
    const ids = selectedBindingIds(p.id);
    if (!ids.size) return;
    if (cfg.bindings.length - ids.size < 1) {
      alert(t('opt.models.keepOne'));
      return;
    }
    const removedModelIds = new Set(cfg.bindings.filter((b) => ids.has(b.id)).map((b) => b.modelId));
    const bindings = cfg.bindings.filter((b) => !ids.has(b.id));
    const models = cfg.models.filter((m) => !removedModelIds.has(m.id) || bindings.some((b) => b.modelId === m.id));
    const defaultBindingId = ids.has(cfg.defaultBindingId)
      ? bindings.find((b) => b.enabled !== false)?.id ?? bindings[0].id
      : cfg.defaultBindingId;
    onChange({ ...cfg, models, bindings, defaultBindingId });
    setSelections((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[bindingSelectionKey(p.id, id)];
      return next;
    });
  }

  function toggleBinding(providerId: string, bindingId: string) {
    const key = bindingSelectionKey(providerId, bindingId);
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="panel">
      <h1>{t('opt.providers.title')}</h1>
      <p className="lead">
        {t('opt.providers.leadA')}
        <code>/v1</code>
        {t('opt.providers.leadB')}
        <code>chrome.storage.local</code>
        {t('opt.providers.leadC')}
      </p>

      {cfg.providers.map((p) => {
        const result = discovery[p.id];
        const providerBindings = cfg.bindings.filter((b) => b.providerId === p.id);
        const selectedCount = providerBindings.filter((b) => selections[bindingSelectionKey(p.id, b.id)]).length;
        return (
          <div className="card provider-card" key={p.id}>
            <div className="card-row">
              <Field label={t('opt.providers.name')}>
                <input value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} />
              </Field>
              <Field label={t('opt.providers.baseUrl')} hint={t('opt.providers.baseUrlHint')}>
                <input
                  value={p.baseUrl}
                  spellCheck={false}
                  onChange={(e) => patch(p.id, { baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </Field>
            </div>
            <Field label={t('opt.providers.apiKey')} hint={t('opt.providers.apiKeyHint')}>
              <input
                type="password"
                value={p.apiKey}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => patch(p.id, { apiKey: e.target.value })}
                placeholder="sk-…"
              />
            </Field>
            <div className="card-actions">
              <button className="btn" onClick={() => discover(p)} disabled={result?.state === 'loading'}>
                {result?.state === 'loading' ? t('opt.providers.testing') : t('opt.providers.test')}
              </button>
              <button className="btn" onClick={() => discover(p)} disabled={result?.state === 'loading'}>
                {t('opt.providers.sync')}
              </button>
              {testing[p.id] && (
                <span className={'test-result' + (testing[p.id].startsWith('✓') ? ' ok' : testing[p.id].startsWith('✗') ? ' err' : '')}>
                  {testing[p.id]}
                </span>
              )}
              <span className="spacer" />
              <button className="btn danger" onClick={() => remove(p.id)}>{t('opt.common.delete')}</button>
            </div>

            {result?.state === 'error' && <div className="provider-discovery-error">✗ {result.message}</div>}
            {result?.state === 'done' && (
              <div className="provider-models">
                <div className="provider-models-header">
                  <span>{t('opt.providers.discovered', [result.models.length])}</span>
                  <span className="provider-models-meta">{t('opt.providers.selected', [result.selected.size])}</span>
                </div>
                {result.models.length === 0 ? (
                  <div className="empty-hint">{t('opt.providers.noModels')}</div>
                ) : (
                  <div className="provider-model-list">
                    {result.models.map((model) => {
                      const status = discoveredModelStatus(model, cfg.bindings, p.id);
                      const bound = providerBindings.find((b) => b.apiModelName.toLowerCase() === model.id.toLowerCase());
                      return (
                        <label className="provider-model-row" key={model.id}>
                          <input
                            type="checkbox"
                            checked={result.selected.has(model.id)}
                            disabled={status === 'configured'}
                            onChange={() => toggleDiscovered(p.id, model.id)}
                          />
                          <span className="provider-model-id">{model.id}</span>
                          <span className={'provider-model-status ' + status}>
                            {status === 'configured' ? t('opt.providers.configured') : t('opt.providers.newModel')}
                          </span>
                          {model.ownedBy && <span className="provider-model-label">{model.ownedBy}</span>}
                          {bound && <span className={'provider-binding-status' + (bound.enabled === false ? ' disabled' : '')}>{bound.enabled === false ? t('opt.providers.disabled') : t('opt.providers.enabled')}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="provider-batch-actions">
                  <button className="btn" onClick={() => importSelected(p)} disabled={!result.selected.size}>{t('opt.providers.importSelected', [result.selected.size])}</button>
                </div>
              </div>
            )}

            {providerBindings.length > 0 && (
              <div className="provider-configured">
                <div className="provider-models-header">
                  <span>{t('opt.providers.configuredTitle', [providerBindings.length])}</span>
                  <span className="provider-models-meta">{t('opt.providers.batchSelected', [selectedCount])}</span>
                </div>
                {providerBindings.map((binding) => {
                  const model = cfg.models.find((m) => m.id === binding.modelId);
                  const key = bindingSelectionKey(p.id, binding.id);
                  const unavailable =
                    result?.state === 'done' &&
                    !result.models.some((item) => item.id.toLowerCase() === binding.apiModelName.toLowerCase());
                  return (
                    <div className={'provider-model-row configured-row' + (binding.enabled === false ? ' row-disabled' : '')} key={binding.id}>
                      <input type="checkbox" checked={!!selections[key]} onChange={() => toggleBinding(p.id, binding.id)} />
                      <span className="provider-model-id">{binding.apiModelName}</span>
                      <span className="provider-model-label">{model?.label ?? binding.modelId}</span>
                      {unavailable && <span className="provider-model-status stale">{t('opt.providers.unavailable')}</span>}
                      <button type="button" className="link-button" onClick={() => setEnabled(binding.id, binding.enabled === false)}>
                        {binding.enabled === false ? t('opt.providers.enable') : t('opt.providers.disable')}
                      </button>
                    </div>
                  );
                })}
                <div className="provider-batch-actions">
                  <button className="btn" disabled={!selectedCount} onClick={() => batchSetEnabled(p, true)}>{t('opt.providers.enableSelected')}</button>
                  <button className="btn" disabled={!selectedCount} onClick={() => batchSetEnabled(p, false)}>{t('opt.providers.disableSelected')}</button>
                  <button className="btn danger" disabled={!selectedCount} onClick={() => batchDelete(p)}>{t('opt.providers.deleteSelected')}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button className="btn add" onClick={add}>{t('opt.providers.add')}</button>
    </div>
  );
}

function bindingSelectionKey(providerId: string, bindingId: string): string {
  return `${providerId}:${bindingId}`;
}
