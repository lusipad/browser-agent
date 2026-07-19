import { useEffect, useRef, useState } from 'react';
import type { TimelineItem } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { exportSession, type ExportMeta } from '../export';

interface Props {
  items: TimelineItem[];
  meta: ExportMeta;
}

/** 导出按钮 + 弹出选择 Markdown / JSON */
export function ExportMenu({ items, meta }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const disabled = items.length === 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(format: 'md' | 'json') {
    setOpen(false);
    exportSession(format, items, meta, t);
  }

  return (
    <div className="export-wrap" ref={wrap}>
      <button
        className="icon-btn"
        title={t('header.export')}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        ⬇
      </button>
      {open && !disabled && (
        <div className="export-menu">
          <button onClick={() => pick('md')}>{t('export.md')}</button>
          <button onClick={() => pick('json')}>{t('export.json')}</button>
        </div>
      )}
    </div>
  );
}
