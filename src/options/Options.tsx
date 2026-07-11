import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../shared/settings';
import type { AppConfig } from '../shared/types';
import { ProvidersPanel } from './panels/ProvidersPanel';
import { ModelsPanel } from './panels/ModelsPanel';
import { SafetyPanel } from './panels/SafetyPanel';
import { AdvancedPanel } from './panels/AdvancedPanel';
import { SitesPanel } from './panels/SitesPanel';
import { DiagnosticsPanel } from './panels/DiagnosticsPanel';

type Tab = 'providers' | 'models' | 'safety' | 'sites' | 'advanced' | 'diagnostics';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'providers', label: '服务商 / API Key' },
  { id: 'models', label: '模型' },
  { id: 'safety', label: '安全与确认' },
  { id: 'sites', label: '站点权限' },
  { id: 'advanced', label: '高级' },
  { id: 'diagnostics', label: '诊断' },
];

export function Options() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tab, setTab] = useState<Tab>('providers');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    void loadConfig().then(setCfg);
  }, []);

  async function update(next: AppConfig) {
    setCfg(next);
    await saveConfig(next);
    setSavedAt(Date.now());
  }

  if (!cfg) return <div className="loading">加载中…</div>;

  return (
    <div className="opt">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="logo" />
          <div>
            <div className="side-title">Browser Agent</div>
            <div className="side-sub">设置</div>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={'nav-item' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {savedAt > 0 && <span className="saved">✓ 已自动保存</span>}
          <button
            className="reset"
            onClick={() => {
              if (confirm('恢复所有设置为默认值？（不会清除已填写的 API Key 之外的对话）')) {
                void update(structuredClone(DEFAULT_CONFIG));
              }
            }}
          >
            恢复默认
          </button>
        </div>
      </aside>

      <main className="content">
        {tab === 'providers' && <ProvidersPanel cfg={cfg} onChange={update} />}
        {tab === 'models' && <ModelsPanel cfg={cfg} onChange={update} />}
        {tab === 'safety' && <SafetyPanel cfg={cfg} onChange={update} />}
        {tab === 'sites' && <SitesPanel cfg={cfg} onChange={update} />}
        {tab === 'advanced' && <AdvancedPanel cfg={cfg} onChange={update} />}
        {tab === 'diagnostics' && <DiagnosticsPanel />}
      </main>
    </div>
  );
}
