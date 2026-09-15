import { useEffect, useMemo, useState } from 'react';
import { detectLang, makeT, resolveLang, type Lang, type MsgKey } from '../shared/i18n';
import { I18nProvider } from '../shared/i18nReact';
import { DEFAULT_CONFIG, loadConfig, onConfigChange, saveConfig } from '../shared/settings';
import type { AppConfig } from '../shared/types';
import { ProvidersPanel } from './panels/ProvidersPanel';
import { ModelsPanel } from './panels/ModelsPanel';
import { SafetyPanel } from './panels/SafetyPanel';
import { AdvancedPanel } from './panels/AdvancedPanel';
import { SitesPanel } from './panels/SitesPanel';
import { DiagnosticsPanel } from './panels/DiagnosticsPanel';
import { SkillsPanel } from './panels/SkillsPanel';

type Tab = 'providers' | 'models' | 'skills' | 'safety' | 'sites' | 'advanced' | 'diagnostics';

const TABS: Array<{ id: Tab; labelKey: MsgKey }> = [
  { id: 'providers', labelKey: 'opt.providers.title' },
  { id: 'models', labelKey: 'opt.models.title' },
  { id: 'skills', labelKey: 'opt.skills.title' },
  { id: 'safety', labelKey: 'opt.safety.title' },
  { id: 'sites', labelKey: 'opt.sites.title' },
  { id: 'advanced', labelKey: 'opt.advanced.title' },
  { id: 'diagnostics', labelKey: 'opt.diagnostics.title' },
];

export function Options() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tab, setTab] = useState<Tab>('providers');
  const [savedAt, setSavedAt] = useState(0);
  const [lang, setLang] = useState<Lang>(detectLang());
  const t = useMemo(() => makeT(lang), [lang]);

  // 界面语言：加载配置 + 监听变更
  useEffect(() => {
    void loadConfig().then((c) => {
      setCfg(c);
      setLang(resolveLang(c.uiLang));
    });
    onConfigChange((c) => setLang(resolveLang(c.uiLang)));
  }, []);

  async function update(next: AppConfig) {
    setCfg(next);
    await saveConfig(next);
    setSavedAt(Date.now());
  }

  if (!cfg) return <div className="loading">{t('opt.shell.loading')}</div>;

  return (
    <I18nProvider value={t}>
      <div className="opt">
        <aside className="sidebar">
          <div className="side-brand">
            <span className="logo" />
            <div>
              <div className="side-title">Browser Agent</div>
              <div className="side-sub">{t('opt.shell.settings')}</div>
            </div>
          </div>
          <nav>
            {TABS.map((item) => (
              <button
                key={item.id}
                className={'nav-item' + (tab === item.id ? ' active' : '')}
                onClick={() => setTab(item.id)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
          <div className="side-foot">
            {savedAt > 0 && <span className="saved">{t('opt.shell.saved')}</span>}
            <button
              className="reset"
              onClick={() => {
                if (confirm(t('opt.shell.resetConfirm'))) {
                  void update(structuredClone(DEFAULT_CONFIG));
                }
              }}
            >
              {t('opt.shell.reset')}
            </button>
          </div>
        </aside>

        <main className="content">
          {tab === 'providers' && <ProvidersPanel cfg={cfg} onChange={update} />}
          {tab === 'models' && <ModelsPanel cfg={cfg} onChange={update} />}
          {tab === 'skills' && <SkillsPanel />}
          {tab === 'safety' && <SafetyPanel cfg={cfg} onChange={update} />}
          {tab === 'sites' && <SitesPanel cfg={cfg} onChange={update} />}
          {tab === 'advanced' && <AdvancedPanel cfg={cfg} onChange={update} />}
          {tab === 'diagnostics' && <DiagnosticsPanel />}
        </main>
      </div>
    </I18nProvider>
  );
}
