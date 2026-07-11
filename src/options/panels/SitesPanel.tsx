import { useState } from 'react';
import type { PanelProps } from './common';

export function SitesPanel({ cfg, onChange }: PanelProps) {
  return (
    <div className="panel">
      <h1>站点权限</h1>
      <p className="lead">
        <b>允许列表</b>中的网站无需每次确认即可操作；<b>黑名单</b>中的网站会被完全阻止（银行、支付、交易所等已预置）。
        支持精确域名或 <code>*.example.com</code> 形式，匹配其所有子域名。
      </p>
      <ListEditor
        title="始终允许（白名单）"
        emptyHint="还没有始终允许的网站。你在侧边栏点「始终允许此站点」时会自动加入这里。"
        items={cfg.sites.allowed}
        placeholder="example.com"
        onChange={(allowed) => onChange({ ...cfg, sites: { ...cfg.sites, allowed } })}
      />
      <ListEditor
        title="始终阻止（黑名单）"
        emptyHint="黑名单为空。"
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
          添加
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
