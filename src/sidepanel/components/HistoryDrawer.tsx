import type { ConvMeta } from '../../shared/types';

interface Props {
  conversations: ConvMeta[];
  activeId: string;
  running: boolean;
  onClose: () => void;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryDrawer({ conversations, activeId, running, onClose, onNew, onSwitch, onDelete }: Props) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">会话历史</span>
          <button className="icon-btn" title="关闭" onClick={onClose}>
            ✕
          </button>
        </div>
        <button className="btn primary drawer-new" onClick={onNew} disabled={running}>
          ＋ 新对话
        </button>
        {conversations.length === 0 ? (
          <div className="drawer-empty">还没有历史会话。开始对话后会自动保存到这里。</div>
        ) : (
          <ul className="conv-list">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={'conv-item' + (c.id === activeId ? ' active' : '')}
                onClick={() => !running && c.id !== activeId && onSwitch(c.id)}
                title={running ? '运行中无法切换' : c.title}
              >
                <div className="conv-main">
                  <div className="conv-title">{c.title || '新对话'}</div>
                  <div className="conv-meta">
                    {c.id === activeId && <span className="conv-badge">当前</span>}
                    {timeAgo(c.updatedAt)} · {c.msgCount} 条
                  </div>
                </div>
                <button
                  className="conv-del"
                  title="删除会话"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`删除会话「${c.title || '新对话'}」？此操作不可撤销。`)) onDelete(c.id);
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
