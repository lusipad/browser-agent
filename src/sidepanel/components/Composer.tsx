import { useEffect, useRef, useState } from 'react';
import { useT } from '../../shared/i18nReact';
import type { RegionSnippet } from '../../shared/types';
import type { SkillMeta } from '../../shared/skill';

interface Props {
  running: boolean;
  hasModel: boolean;
  region?: RegionSnippet | null;
  skills?: SkillMeta[];
  draftText?: string;
  onClearDraft?: () => void;
  onClearRegion?: () => void;
  onSelectRegion?: () => void;
  onSelectSkill?: (skillId: string) => void;
  onToggleSkills?: () => void;
  onToggleHistory?: () => void;
  onSend: (text: string, region?: RegionSnippet) => void;
  onAbort: () => void;
}

export type SlashItem =
  | { kind: 'command'; id: string; name: string; description: string; icon: string; run: () => void }
  | { kind: 'skill'; id: string; name: string; description?: string; icon?: string; pinned?: boolean };

export function Composer(props: Props) {
  const t = useT();
  const [text, setText] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (props.draftText) {
      setText(props.draftText);
      props.onClearDraft?.();
      setTimeout(() => {
        if (taRef.current) {
          taRef.current.focus();
          taRef.current.style.height = 'auto';
          taRef.current.style.height = Math.min(160, taRef.current.scrollHeight) + 'px';
        }
      }, 50);
    }
  }, [props.draftText]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!props.running) props.onSelectRegion?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.running, props.onSelectRegion]);

  const slashMatch = text.startsWith('/') ? text.slice(1).trim().toLowerCase() : null;
  const isSlashMode = slashMatch !== null && !props.running;

  const builtinCommands = [
    {
      id: 'cmd_compact',
      kind: 'command' as const,
      name: '/compact',
      description: '主动提炼并压缩当前长对话上下文',
      icon: '🧹',
      run: () => {
        props.onSend('/compact');
      },
    },
    {
      id: 'cmd_webskill',
      kind: 'command' as const,
      name: '/webSkillCreator',
      description: '探查当前页面并自动生成专属技能定义',
      icon: '🪄',
      run: () => {
        props.onSend('/webSkillCreator');
      },
    },
    {
      id: 'cmd_extract',
      kind: 'command' as const,
      name: '/extract',
      description: '智能提取当前页面的结构化表格、卡片或核心列表',
      icon: '📊',
      run: () => {
        props.onSend('请智能提取当前页面的核心数据（结构化卡片、商品或表格列表），整理为规范表格。');
      },
    },
    {
      id: 'cmd_region',
      kind: 'command' as const,
      name: '/region',
      description: '框选网页特定区域并提问 (Alt+S)',
      icon: '🎯',
      run: () => {
        props.onSelectRegion?.();
      },
    },
    {
      id: 'cmd_skills',
      kind: 'command' as const,
      name: '/skills',
      description: '打开技能库抽屉面板',
      icon: '⚡',
      run: () => {
        props.onToggleSkills?.();
      },
    },
    {
      id: 'cmd_history',
      kind: 'command' as const,
      name: '/history',
      description: '查看以往任务历史记录',
      icon: '📜',
      run: () => {
        props.onToggleHistory?.();
      },
    },
  ];

  const matchingCommands = isSlashMode
    ? builtinCommands.filter((c) => {
        if (!slashMatch) return true;
        return c.name.toLowerCase().includes(slashMatch) || c.description.toLowerCase().includes(slashMatch);
      })
    : [];

  const matchingSkills = isSlashMode
    ? (props.skills ?? []).filter((s) => {
        if (!slashMatch) return true;
        return (
          s.name.toLowerCase().includes(slashMatch) ||
          (s.description || '').toLowerCase().includes(slashMatch)
        );
      })
    : [];

  const combinedItems: SlashItem[] = [
    ...matchingCommands,
    ...matchingSkills.map((s) => ({ ...s, kind: 'skill' as const })),
  ];

  useEffect(() => {
    setSlashIndex(0);
  }, [slashMatch]);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  }

  function handleSelectItem(item: SlashItem) {
    setText('');
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
    if (item.kind === 'command') {
      item.run();
    } else {
      props.onSelectSkill?.(item.id);
    }
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !props.region) || props.running) return;
    props.onSend(trimmed, props.region || undefined);
    setText('');
    props.onClearRegion?.();
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isSlashMode && combinedItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % combinedItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + combinedItems.length) % combinedItems.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault();
        const chosen = combinedItems[slashIndex];
        if (chosen) {
          handleSelectItem(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setText('');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = !props.running && props.hasModel && (!!text.trim() || !!props.region);

  return (
    <div className="composer-container">
      {props.region && (
        <div className="composer-region-chip">
          <img
            src={`data:${props.region.mediaType};base64,${props.region.data}`}
            alt="Region preview"
            className="region-chip-thumb"
          />
          <div className="region-chip-meta">
            <span className="region-chip-title">🎯 {t('composer.regionSelected')}</span>
            <span className="region-chip-dim">{props.region.w} × {props.region.h} px</span>
          </div>
          <button
            className="region-chip-remove"
            onClick={props.onClearRegion}
            title={t('composer.regionRemove')}
          >
            ✕
          </button>
        </div>
      )}

      {isSlashMode && combinedItems.length > 0 && (
        <div className="slash-menu">
          <div className="slash-menu-header">
            <span className="slash-menu-title">⚡ {t('slash.title')}</span>
            <span className="slash-menu-tip">{t('slash.tip')}</span>
          </div>
          <div className="slash-menu-list">
            {combinedItems.map((item, idx) => (
              <div
                key={item.id}
                className={`slash-menu-item ${idx === slashIndex ? 'active' : ''}`}
                onClick={() => handleSelectItem(item)}
                onMouseEnter={() => setSlashIndex(idx)}
              >
                <span className="slash-item-icon">{item.icon || (item.kind === 'command' ? '⚡' : '🛠️')}</span>
                <div className="slash-item-body">
                  <div className="slash-item-name">
                    {item.name}
                    {item.kind === 'command' && <span className="slash-cmd-tag">指令</span>}
                    {item.kind === 'skill' && (item as any).pinned && <span className="skill-pinned-tag">★</span>}
                  </div>
                  {item.description && (
                    <div className="slash-item-desc">{item.description}</div>
                  )}
                </div>
                <span className="slash-item-shortcut">↵</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSlashMode && combinedItems.length === 0 && (
        <div className="slash-menu empty">
          <div className="slash-menu-empty-text">
            <span>🔍 {t('slash.noMatch')}</span>
          </div>
        </div>
      )}

      <div className="composer">
        <button
          className="region-select-btn"
          onClick={props.onSelectRegion}
          disabled={props.running}
          title={t('composer.selectRegion')}
        >
          🎯
        </button>
        <textarea
          ref={taRef}
          className="input"
          value={text}
          placeholder={
            !props.hasModel
              ? t('composer.needModel')
              : props.region
              ? t('composer.regionPlaceholder')
              : t('composer.placeholder')
          }
          onChange={(e) => {
            setText(e.target.value);
            autosize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        {props.running ? (
          <button className="send-btn stop" onClick={props.onAbort} title={t('composer.stop')}>
            ■
          </button>
        ) : (
          <button className="send-btn" onClick={submit} disabled={!canSend} title={t('composer.send')}>
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
