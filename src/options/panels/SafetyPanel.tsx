import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18nReact';
import { Toggle, type PanelProps } from './common';
import { getSyncBytesUsed, isSyncAvailable } from '../../shared/syncStorage';

export function SafetyPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  const s = cfg.safety;
  const sync = cfg.sync ?? { enabled: true, syncApiKeys: false };
  const [bytesUsed, setBytesUsed] = useState<number | null>(null);
  const syncAvailable = isSyncAvailable();

  useEffect(() => {
    if (syncAvailable) {
      void getSyncBytesUsed().then((bytes) => setBytesUsed(bytes));
    }
  }, [syncAvailable, cfg]);

  function patch(p: Partial<typeof s>) {
    onChange({ ...cfg, safety: { ...s, ...p } });
  }

  function patchSync(p: Partial<typeof sync>) {
    onChange({ ...cfg, sync: { ...sync, ...p } });
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

      <h1 style={{ marginTop: '36px' }}>{t('opt.sync.title')}</h1>
      <p className="lead">{t('opt.sync.lead')}</p>

      <div className="card toggles">
        <Toggle
          checked={sync.enabled}
          onChange={(v) => patchSync({ enabled: v })}
          label={t('opt.sync.enabled')}
          hint={t('opt.sync.enabledHint')}
        />
        {syncAvailable && bytesUsed !== null && (
          <div style={{ padding: '6px 0 2px 34px', fontSize: '12px', color: 'var(--text-dim)' }}>
            {t('opt.sync.quotaUsed', [(bytesUsed / 1024).toFixed(1)])}
          </div>
        )}
        {!syncAvailable && (
          <div style={{ padding: '6px 0 2px 34px', fontSize: '12px', color: 'var(--err)' }}>
            {t('opt.sync.notAvailable')}
          </div>
        )}
      </div>

      {sync.enabled && (
        <div className={'card danger-zone' + (sync.syncApiKeys ? ' active' : '')}>
          <Toggle
            checked={sync.syncApiKeys}
            onChange={(v) => {
              if (v && !confirm(t('opt.sync.syncApiKeysConfirm'))) return;
              patchSync({ syncApiKeys: v });
            }}
            label={t('opt.sync.syncApiKeys')}
            hint={t('opt.sync.syncApiKeysHint')}
          />
        </div>
      )}
    </div>
  );
}
