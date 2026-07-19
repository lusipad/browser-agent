import { useState } from 'react';
import type { ApprovalDecision, TimelineItem } from '../../shared/types';
import { renderMarkdown } from '../markdown';
import { toolIcon, toolLabel } from './toolMeta';

interface Props {
  items: TimelineItem[];
  running: boolean;
  onApprove: (id: string, decision: ApprovalDecision) => void;
  onContinue: () => void;
}

export function Timeline({ items, running, onApprove, onContinue }: Props) {
  if (!items.length) return <Welcome />;
  // 只有最后一条「继续」提示可点，避免历史里多个按钮
  const lastContinueId = [...items].reverse().find((it) => it.kind === 'info' && it.action === 'continue')?.id;
  return (
    <div className="timeline">
      {items.map((it) => (
        <Row
          key={it.id}
          item={it}
          onApprove={onApprove}
          onContinue={onContinue}
          canContinue={!running && it.id === lastContinueId}
        />
      ))}
    </div>
  );
}

function Welcome() {
  const examples = [
    '打开 news.ycombinator.com，把前 5 条标题和链接整理给我',
    '在 GitHub 搜索 "browser agent"，告诉我 star 最多的仓库',
    '帮我在当前页面填写这个表单并截图确认',
  ];
  return (
    <div className="welcome">
      <div className="welcome-logo" />
      <h2>Browser Agent</h2>
      <p className="welcome-sub">用自然语言驱动浏览器。它会打开标签页、点击、填表、读取页面并汇报结果。</p>
      <div className="welcome-examples">
        {examples.map((e) => (
          <div className="ex" key={e}>
            {e}
          </div>
        ))}
      </div>
      <p className="welcome-tip">首次操作某个网站时会请求你的授权。敏感操作（密码、上传、执行脚本）需要确认。</p>
    </div>
  );
}

function Row({
  item,
  onApprove,
  onContinue,
  canContinue,
}: {
  item: TimelineItem;
  onApprove: Props['onApprove'];
  onContinue: Props['onContinue'];
  canContinue: boolean;
}) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="row user">
          <div className="bubble">{item.text}</div>
        </div>
      );
    case 'assistant':
      return (
        <div className="row assistant">
          <div
            className={'md' + (item.done ? '' : ' streaming')}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text || (item.done ? '' : '…')) }}
          />
        </div>
      );
    case 'tool':
      return <ToolRow item={item} />;
    case 'approval':
      return <ApprovalRow item={item} onApprove={onApprove} />;
    case 'error':
      return (
        <div className="row">
          <div className="notice error">⚠ {item.text}</div>
        </div>
      );
    case 'info':
      return (
        <div className="row">
          <div className="notice info">
            {item.text}
            {item.action === 'continue' && canContinue && (
              <button className="btn primary continue-btn" onClick={onContinue}>
                继续执行 ↵
              </button>
            )}
          </div>
        </div>
      );
  }
}

function ToolRow({ item }: { item: Extract<TimelineItem, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  const images = (item.images ?? []).filter((x): x is string => !!x);
  const dot = item.status === 'running' ? 'running' : item.status === 'error' ? 'error' : 'ok';
  return (
    <div className={'row tool ' + dot}>
      <div className="tool-head" onClick={() => setOpen((o) => !o)}>
        <span className={'status-dot ' + dot} />
        <span className="tool-icon">{toolIcon(item.name)}</span>
        <span className="tool-name">{toolLabel(item.name)}</span>
        <span className="tool-summary">{item.summary}</span>
        {(item.detail || images.length > 0) && <span className="chevron">{open ? '▾' : '▸'}</span>}
      </div>
      {images.length > 0 && (
        <div className="tool-shots">
          {images.map((src, i) => (
            <img key={i} src={src} alt="screenshot" onClick={() => window.open(src, '_blank')} />
          ))}
        </div>
      )}
      {open && item.detail && <pre className="tool-detail">{item.detail}</pre>}
    </div>
  );
}

function ApprovalRow({
  item,
  onApprove,
}: {
  item: Extract<TimelineItem, { kind: 'approval' }>;
  onApprove: Props['onApprove'];
}) {
  const decided = !!item.decision;
  const label: Record<ApprovalDecision, string> = {
    allow_once: '已允许（本次）',
    allow_site: '已允许（始终）',
    deny: '已拒绝',
  };
  return (
    <div className={'row approval' + (decided ? ' decided' : '')}>
      <div className="approval-card">
        <div className="approval-title">🔒 {item.title}</div>
        <div className="approval-desc">{item.description}</div>
        {decided ? (
          <div className={'approval-result ' + (item.decision === 'deny' ? 'deny' : 'allow')}>
            {label[item.decision!]}
          </div>
        ) : (
          <div className="approval-actions">
            <button className="btn primary" onClick={() => onApprove(item.id, 'allow_once')}>
              仅本次
            </button>
            {item.siteOption && (
              <button className="btn" onClick={() => onApprove(item.id, 'allow_site')}>
                始终允许此站点
              </button>
            )}
            <button className="btn danger" onClick={() => onApprove(item.id, 'deny')}>
              拒绝
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
