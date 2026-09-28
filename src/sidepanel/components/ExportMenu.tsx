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
  const [exported, setExported] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

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
    setExported(true);
    setTimeout(() => setExported(false), 1500);
  }

  return (
    <div className="export-wrap" ref={wrap}>
      <button
        className={`icon-btn${exported ? ' exported' : ''}`}
        title={exported ? t('export.exported') : t('header.export')}
        onClick={() => setOpen((o) => !o)}
      >
        {exported ? '✓' : '⬇'}
      </button>
      {open && (
        <div className="export-menu">
          <button onClick={() => pick('md')}>{t('export.md')}</button>
          <button onClick={() => pick('json')}>{t('export.json')}</button>
        </div>
      )}
    </div>
  );
}
