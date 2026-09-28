import { useEffect, useRef, useState } from 'react';
import type { ApprovalDecision, TimelineItem } from '../../shared/types';
import { useT } from '../../shared/i18nReact';
import { renderMarkdown } from '../markdown';
import { toolIcon, toolLabel } from './toolMeta';
import { download } from '../export';

interface Props {
  items: TimelineItem[];
  running: boolean;
  onApprove: (id: string, decision: ApprovalDecision) => void;
  onContinue: () => void;
  onResolveIntervention?: (id: string) => void;
  onAbort?: () => void;
  onSelectExample?: (text: string) => void;
  onSaveSkill?: () => void;
}

export function Timeline({
  items,
  running,
  onApprove,
  onContinue,
  onResolveIntervention,
  onAbort,
  onSelectExample,
  onSaveSkill,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  if (!items.length) return <Welcome onSelect={onSelectExample} />;
  // 只有最后一条「继续」提示可点，避免历史里多个按钮
  const lastContinueId = [...items].reverse().find((it) => it.kind === 'info' && it.action === 'continue')?.id;
  return (
    <>
      <div className="timeline">
        {items.map((it) => (
          <Row
            key={it.id}
            item={it}
            onApprove={onApprove}
            onContinue={onContinue}
            onResolveIntervention={onResolveIntervention}
            onAbort={onAbort}
            onPreview={setPreviewSrc}
            onSaveSkill={onSaveSkill}
            running={running}
            canContinue={!running && it.id === lastContinueId}
          />
        ))}
      </div>
      <Lightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </>
  );
}

function Welcome({ onSelect }: { onSelect?: (text: string) => void }) {
  const t = useT();
  const examples = [t('welcome.ex1'), t('welcome.ex2'), t('welcome.ex3')];
  return (
    <div className="welcome">
      <div className="welcome-logo" />
      <h2>Browser Agent</h2>
      <p className="welcome-sub">{t('welcome.sub')}</p>
      <div className="welcome-examples">
        {examples.map((e) => (
          <button
            type="button"
            className="ex"
            key={e}
            onClick={() => onSelect?.(e)}
            title="点击直接执行"
          >
            {e}
          </button>
        ))}
      </div>
      <p className="welcome-tip">{t('welcome.tip')}</p>
    </div>
  );
}

function Row({
  item,
  onApprove,
  onContinue,
  onResolveIntervention,
  onAbort,
  onPreview,
  onSaveSkill,
  running,
  canContinue,
}: {
  item: TimelineItem;
  onApprove: Props['onApprove'];
  onContinue: Props['onContinue'];
  onResolveIntervention?: Props['onResolveIntervention'];
  onAbort?: Props['onAbort'];
  onPreview: (src: string) => void;
  onSaveSkill?: () => void;
  running: boolean;
  canContinue: boolean;
}) {
  const t = useT();
  switch (item.kind) {
    case 'user':
      return (
        <div className="row user">
          <div className="bubble">
            {item.image && (
              <div className="user-region-preview" onClick={() => onPreview(item.image!)}>
                <img src={item.image} alt="User region selection" className="user-region-img" />
                {item.regionInfo && (
                  <span className="user-region-badge">🎯 {item.regionInfo.w}×{item.regionInfo.h}</span>
                )}
              </div>
            )}
            {item.text && <div>{item.text}</div>}
          </div>
        </div>
      );
    case 'assistant':
      return (
        <AssistantRow
          item={item}
          onSaveSkill={onSaveSkill}
          running={running}
        />
      );
    case 'tool':
      return <ToolRow item={item} onPreview={onPreview} />;
    case 'approval':
      return <ApprovalRow item={item} onApprove={onApprove} />;
    case 'human_intervention':
      return <HumanInterventionRow item={item} onResolve={onResolveIntervention} onAbort={onAbort} />;
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
                {t('timeline.continue')}
              </button>
            )}
          </div>
        </div>
      );
    case 'skill_prompt':
      return (
        <div className="row">
          <div className="notice skill-prompt">
            <div className="skill-prompt-text">
              <span className="skill-prompt-icon">✨</span>
              <span>{t('skill.promptDesc')}</span>
            </div>
            <button className="btn primary skill-save-btn" onClick={onSaveSkill} disabled={running}>
              {t('skill.saveBtn')}
            </button>
          </div>
        </div>
      );
  }
}

function ToolRow({
  item,
  onPreview,
}: {
  item: Extract<TimelineItem, { kind: 'tool' }>;
  onPreview: (src: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const images = (item.images ?? []).filter((x): x is string => !!x);
  const dot = item.status === 'running' ? 'running' : item.status === 'error' ? 'error' : 'ok';
  return (
    <div className={'row tool ' + dot}>
      <div className="tool-head" onClick={() => setOpen((o) => !o)}>
        <span className={'status-dot ' + dot} />
        <span className="tool-icon">{toolIcon(item.name)}</span>
        <span className="tool-name">{toolLabel(item.name, t)}</span>
        <span className="tool-summary">{item.summary}</span>
        {(item.detail || images.length > 0) && <span className="chevron">{open ? '▾' : '▸'}</span>}
      </div>
      {images.length > 0 && (
        <div className="tool-shots">
          {images.map((src, i) => (
            <img key={i} src={src} alt="screenshot" onClick={() => onPreview(src)} />
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
  const t = useT();
  const decided = !!item.decision;
  const label: Record<ApprovalDecision, string> = {
    allow_once: t('approval.decidedOnce'),
    allow_site: t('approval.decidedSite'),
    deny: t('approval.decidedDeny'),
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
              {t('approval.allowOnce')}
            </button>
            {item.siteOption && (
              <button className="btn" onClick={() => onApprove(item.id, 'allow_site')}>
                {t('approval.allowSite')}
              </button>
            )}
            <button className="btn danger" onClick={() => onApprove(item.id, 'deny')}>
              {t('approval.deny')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HumanInterventionRow({
  item,
  onResolve,
  onAbort,
}: {
  item: Extract<TimelineItem, { kind: 'human_intervention' }>;
  onResolve?: (id: string) => void;
  onAbort?: () => void;
}) {
  const t = useT();
  const isResolved = item.status === 'resolved';

  const reasonLabels: Record<string, string> = {
    captcha: t('human.reasonCaptcha'),
    slider: t('human.reasonSlider'),
    sms_code: t('human.reasonSms'),
    login: t('human.reasonLogin'),
    other: t('human.reasonOther'),
  };

  const reasonText = reasonLabels[item.reason || 'captcha'] || t('human.reasonCaptcha');

  return (
    <div className={'row human-intervention' + (isResolved ? ' resolved' : ' waiting')}>
      <div className="intervention-card">
        <div className="intervention-header">
          <span className="intervention-badge">✋ {reasonText}</span>
          <span className="intervention-title">{item.title}</span>
        </div>
        <div className="intervention-hint">{item.hint}</div>
        {isResolved ? (
          <div className="intervention-resolved">
            ✓ {t('human.resolved')}
          </div>
        ) : (
          <div className="intervention-actions">
            <button
              type="button"
              className="btn primary intervention-resume-btn"
              onClick={() => onResolve?.(item.id)}
            >
              {t('human.resumeBtn')}
            </button>
            {onAbort && (
              <button
                type="button"
                className="btn secondary"
                onClick={onAbort}
              >
                {t('human.abortBtn')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantRow({
  item,
  onSaveSkill,
  running,
}: {
  item: Extract<TimelineItem, { kind: 'assistant' }>;
  onSaveSkill?: () => void;
  running: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [tableCopied, setTableCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasTable = Boolean(item.text && /\|[ \t]*[-:]+[-| :]*\|/.test(item.text));

  async function handleCopy() {
    if (!item.text) return;
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function extractMarkdownTable(text: string): string | null {
    const lines = text.split('\n');
    const tableLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        tableLines.push(trimmed);
      } else if (inTable) {
        break;
      }
    }
    return tableLines.length >= 2 ? tableLines.join('\n') : null;
  }

  async function handleCopyTable() {
    if (!item.text) return;
    const tableMd = extractMarkdownTable(item.text);
    if (!tableMd) return;
    try {
      await navigator.clipboard.writeText(tableMd);
      setTableCopied(true);
      setTimeout(() => setTableCopied(false), 1500);
    } catch {}
  }

  function handleDownloadCsv() {
    if (!item.text) return;
    const tableMd = extractMarkdownTable(item.text);
    if (!tableMd) return;

    const lines = tableMd.split('\n');
    const csvRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (i === 1 && /\|[ \t]*[-:]+/.test(lines[i])) continue;
      const rawCells = lines[i].split('|').slice(1, -1);
      const row = rawCells
        .map((c) => {
          const cell = c.trim().replace(/"/g, '""');
          return `"${cell}"`;
        })
        .join(',');
      csvRows.push(row);
    }

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    download(`table-data-${Date.now()}.csv`, csvContent, 'text/csv;charset=utf-8;');
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('code-copy-btn')) {
      const pre = target.closest('pre');
      const code = pre?.querySelector('code')?.innerText ?? '';
      if (code) {
        void navigator.clipboard.writeText(code);
        target.innerText = '✓';
        setTimeout(() => {
          target.innerText = '📋';
        }, 1500);
      }
    }
  }

  return (
    <div className="row assistant">
      <div
        ref={contentRef}
        onClick={handleContentClick}
        className={'md' + (item.done ? '' : ' streaming')}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text || (item.done ? '' : '…')) }}
      />
      {item.done && item.text && (
        <div className="msg-actions">
          <button
            type="button"
            className={`msg-act-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? t('msg.copied') : t('msg.copy')}
          >
            {copied ? `✓ ${t('msg.copied')}` : `📋 ${t('msg.copy')}`}
          </button>
          {hasTable && (
            <>
              <button
                type="button"
                className={`msg-act-btn ${tableCopied ? 'copied' : ''}`}
                onClick={handleCopyTable}
                title={t('msg.copyMarkdownTable')}
              >
                {tableCopied ? `✓ ${t('msg.copied')}` : `📊 ${t('msg.copyMarkdownTable')}`}
              </button>
              <button
                type="button"
                className="msg-act-btn"
                onClick={handleDownloadCsv}
                title={t('msg.downloadCsv')}
              >
                📥 {t('msg.downloadCsv')}
              </button>
            </>
          )}
          {onSaveSkill && (
            <button
              type="button"
              className="msg-act-btn skill-act"
              onClick={onSaveSkill}
              disabled={running}
              title={t('msg.saveAsSkill')}
            >
              🎯 {t('msg.saveAsSkill')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function openImageInNewTab(src: string) {
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Screenshot Preview</title><style>body{margin:0;background:#0d1117;display:flex;align-items:center;justify-content:center;min-height:100vh}img{max-width:96%;height:auto;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,0.6)}</style></head><body><img src="${src}"></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    void chrome.tabs.create({ url });
  } catch {
    /* ignore */
  }
}

function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    if (!src) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-btn" onClick={() => openImageInNewTab(src)}>
          {t('timeline.openNewTab')}
        </button>
        <button className="lightbox-btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <div className="lightbox-img-wrap" onClick={(e) => e.stopPropagation()}>
        <img className="lightbox-img" src={src} alt="screenshot zoom" onClick={onClose} />
      </div>
    </div>
  );
}

