import { useT } from '../../shared/i18nReact';
import { Toggle, type PanelProps } from './common';

export function SafetyPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const s = cfg.safety;
  function patch(p: Partial<typeof s>) {
    onChange({ ...cfg, safety: { ...s, ...p } });
  }
  return (
    <div className="panel">
      <h1>{t('opt.safety.title')}</h1>
      <p className="lead">{t('opt.safety.lead')}</p>

      <div className="card toggles">
        <Toggle
          checked={s.confirmNewSite}
          onChange={(v) => patch({ confirmNewSite: v })}
          label={t('opt.safety.newSite')}
          hint={t('opt.safety.newSiteHint')}
        />
        <Toggle
          checked={s.confirmPassword}
          onChange={(v) => patch({ confirmPassword: v })}
          label={t('opt.safety.password')}
          hint={t('opt.safety.passwordHint')}
        />
        <Toggle
          checked={s.confirmUpload}
          onChange={(v) => patch({ confirmUpload: v })}
          label={t('opt.safety.upload')}
        />
        <Toggle
          checked={s.confirmJavascript}
          onChange={(v) => patch({ confirmJavascript: v })}
          label={t('opt.safety.javascript')}
          hint={t('opt.safety.javascriptHint')}
        />
      </div>

      <div className={'card danger-zone' + (s.allowAllSites ? ' active' : '')}>
        <Toggle
          checked={s.allowAllSites}
          onChange={(v) => {
            if (v && !confirm(t('opt.safety.allowAllConfirm'))) return;
            patch({ allowAllSites: v });
          }}
          label={t('opt.safety.allowAll')}
          hint={t('opt.safety.allowAllHint')}
        />
      </div>
    </div>
  );
}
