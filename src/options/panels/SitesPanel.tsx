import { useState } from 'react';
import { useT } from '../../shared/i18nReact';
import type { PanelProps } from './common';

export function SitesPanel({ cfg, onChange }: PanelProps) {
  const t = useT();
  return (
    <div className="panel">
      <h1>{t('opt.sites.title')}</h1>
      <p className="lead">
        {t('opt.sites.leadA')}
        <code>*.example.com</code>
        {t('opt.sites.leadB')}
      </p>
      <ListEditor
        title={t('opt.sites.allowTitle')}
        emptyHint={t('opt.sites.allowEmpty')}
        items={cfg.sites.allowed}
        placeholder="example.com"
        onChange={(allowed) => onChange({ ...cfg, sites: { ...cfg.sites, allowed } })}
      />
      <ListEditor
        title={t('opt.sites.blockTitle')}
        emptyHint={t('opt.sites.blockEmpty')}
        items={cfg.sites.blocked}
        placeholder="bank.com"
        danger
        onChange={(blocked) => onChange({ ...cfg, sites: { ...cfg.sites, blocked } })}
      />
    </div>
  );
}

function ListEditor({
  title,
  items,
  placeholder,
  emptyHint,
  danger,
  onChange,
}: {
  title: string;
  items: string[];
  placeholder: string;
  emptyHint: string;
  danger?: boolean;
  onChange: (items: string[]) => void;
}) {
  const t = useT();
  const [val, setVal] = useState('');
  function add() {
    const v = val.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setVal('');
  }
  return (
    <div className="card">
      <div className="list-title">{title}</div>
      <div className="chip-input">
        <input
          value={val}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button className="btn" onClick={add}>
          {t('opt.sites.add')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="empty-hint">{emptyHint}</div>
      ) : (
        <div className="chips">
          {items.map((it) => (
            <span className={'chip' + (danger ? ' danger' : '')} key={it}>
              {it}
              <button onClick={() => onChange(items.filter((x) => x !== it))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
