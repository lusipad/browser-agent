import { useState } from 'react';
import type { ProviderConfig } from '../../shared/types';
import { uid } from '../../shared/util';
import { useT } from '../../shared/i18nReact';
import { Field, type PanelProps } from './common';

export function ProvidersPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const [testing, setTesting] = useState<Record<string, string>>({});

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
    if (cfg.models.some((m) => m.providerId === id)) {
      alert(t('opt.providers.hasModels'));
      return;
    }
    onChange({ ...cfg, providers: cfg.providers.filter((x) => x.id !== id) });
  }

  async function test(p: ProviderConfig) {
    setTesting((s) => ({ ...s, [p.id]: t('opt.providers.testing') }));
    try {
      const resp = await fetch(p.baseUrl.replace(/\/+$/, '') + '/models', {
        headers: p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {},
      });
      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        const n = Array.isArray(j?.data) ? j.data.length : null;
        setTesting((s) => ({ ...s, [p.id]: n != null ? t('opt.providers.testOkN', [n]) : t('opt.providers.testOk') }));
      } else {
        setTesting((s) => ({ ...s, [p.id]: `✗ HTTP ${resp.status}` }));
      }
    } catch (e) {
      setTesting((s) => ({ ...s, [p.id]: `✗ ${e instanceof Error ? e.message : t('opt.providers.testFail')}` }));
    }
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

      {cfg.providers.map((p) => (
        <div className="card" key={p.id}>
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
            <button className="btn" onClick={() => test(p)}>
              {t('opt.providers.test')}
            </button>
            {testing[p.id] && (
              <span className={'test-result' + (testing[p.id].startsWith('✓') ? ' ok' : testing[p.id].startsWith('✗') ? ' err' : '')}>
                {testing[p.id]}
              </span>
            )}
            <span className="spacer" />
            <button className="btn danger" onClick={() => remove(p.id)}>
              {t('opt.common.delete')}
            </button>
          </div>
        </div>
      ))}

      <button className="btn add" onClick={add}>
        {t('opt.providers.add')}
      </button>
    </div>
  );
}
