import { useState } from 'react';
import type { ProviderConfig } from '../../shared/types';
import { uid } from '../../shared/util';
import { Field, type PanelProps } from './common';

export function ProvidersPanel({ cfg, onChange }: PanelProps) {
  const [testing, setTesting] = useState<Record<string, string>>({});

  function patch(id: string, p: Partial<ProviderConfig>) {
    onChange({ ...cfg, providers: cfg.providers.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  }
  function add() {
    const id = uid('prov');
    onChange({
      ...cfg,
      providers: [...cfg.providers, { id, name: '新服务商', baseUrl: 'https://', apiKey: '' }],
    });
  }
  function remove(id: string) {
    if (cfg.models.some((m) => m.providerId === id)) {
      alert('该服务商下还有模型，请先在「模型」页删除它们。');
      return;
    }
    onChange({ ...cfg, providers: cfg.providers.filter((x) => x.id !== id) });
  }

  async function test(p: ProviderConfig) {
    setTesting((t) => ({ ...t, [p.id]: '测试中…' }));
    try {
      const resp = await fetch(p.baseUrl.replace(/\/+$/, '') + '/models', {
        headers: p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {},
      });
      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        const n = Array.isArray(j?.data) ? j.data.length : null;
        setTesting((t) => ({ ...t, [p.id]: `✓ 连接成功${n != null ? `（${n} 个模型）` : ''}` }));
      } else {
        setTesting((t) => ({ ...t, [p.id]: `✗ HTTP ${resp.status}` }));
      }
    } catch (e) {
      setTesting((t) => ({ ...t, [p.id]: `✗ ${e instanceof Error ? e.message : '连接失败'}` }));
    }
  }

  return (
    <div className="panel">
      <h1>服务商 / API Key</h1>
      <p className="lead">
        任何 <b>OpenAI 兼容</b> 的接口都能接入。Base URL 需包含 <code>/v1</code>。密钥仅保存在本机浏览器
        <code>chrome.storage.local</code> 中，不会上传到任何服务器。
      </p>

      {cfg.providers.map((p) => (
        <div className="card" key={p.id}>
          <div className="card-row">
            <Field label="名称">
              <input value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} />
            </Field>
            <Field label="Base URL" hint="例如 https://api.openai.com/v1">
              <input
                value={p.baseUrl}
                spellCheck={false}
                onChange={(e) => patch(p.id, { baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
          </div>
          <Field label="API Key" hint="本地 Ollama 等无需鉴权可随意填写（如 ollama）">
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
              测试连接
            </button>
            {testing[p.id] && (
              <span className={'test-result' + (testing[p.id].startsWith('✓') ? ' ok' : testing[p.id].startsWith('✗') ? ' err' : '')}>
                {testing[p.id]}
              </span>
            )}
            <span className="spacer" />
            <button className="btn danger" onClick={() => remove(p.id)}>
              删除
            </button>
          </div>
        </div>
      ))}

      <button className="btn add" onClick={add}>
        + 添加服务商
      </button>
    </div>
  );
}
