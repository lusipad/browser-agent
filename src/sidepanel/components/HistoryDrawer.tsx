import type { ConvMeta } from '../../shared/types';
import type { TFn } from '../../shared/i18n';
import { useT } from '../../shared/i18nReact';

interface Props {
  conversations: ConvMeta[];
  activeId: string;
  running: boolean;
  onClose: () => void;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

function timeAgo(ts: number, t: TFn): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('time.justNow');
  if (min < 60) return t('time.minsAgo', [min]);
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('time.hoursAgo', [hr]);
  const day = Math.floor(hr / 24);
  if (day < 30) return t('time.daysAgo', [day]);
  return new Date(ts).toLocaleDateString();
}

export function HistoryDrawer({ conversations, activeId, running, onClose, onNew, onSwitch, onDelete }: Props) {
  const t = useT();
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">{t('history.title')}</span>
          <button className="icon-btn" title={t('history.close')} onClick={onClose}>
            ✕
          </button>
        </div>
        <button className="btn primary drawer-new" onClick={onNew} disabled={running}>
          {t('history.new')}
        </button>
        {conversations.length === 0 ? (
          <div className="drawer-empty">{t('history.empty')}</div>
        ) : (
          <ul className="conv-list">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={'conv-item' + (c.id === activeId ? ' active' : '')}
                onClick={() => !running && c.id !== activeId && onSwitch(c.id)}
                title={running ? t('history.noSwitch') : c.title}
              >
                <div className="conv-main">
                  <div className="conv-title">{c.title || t('history.untitled')}</div>
                  <div className="conv-meta">
                    {c.id === activeId && <span className="conv-badge">{t('history.current')}</span>}
                    {timeAgo(c.updatedAt, t)} · {t('history.msgCount', [c.msgCount])}
                  </div>
                </div>
                <button
                  className="conv-del"
                  title={t('history.delTitle')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('history.delConfirm', [c.title || t('history.untitled')]))) onDelete(c.id);
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
