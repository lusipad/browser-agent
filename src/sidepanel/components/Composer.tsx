import { useEffect, useRef, useState } from 'react';
import { useT } from '../../shared/i18nReact';
import type { RegionSnippet } from '../../shared/types';
import type { SkillMeta } from '../../shared/skill';

interface Props {
  running: boolean;
  hasModel: boolean;
  region?: RegionSnippet | null;
  skills?: SkillMeta[];
  onClearRegion?: () => void;
  onSelectRegion?: () => void;
  onSelectSkill?: (skillId: string) => void;
  onSend: (text: string, region?: RegionSnippet) => void;
  onAbort: () => void;
}

export function Composer(props: Props) {
  const t = useT();
  const [text, setText] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

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

  const matchingSkills = isSlashMode
    ? (props.skills ?? []).filter((s) => {
        if (!slashMatch) return true;
        return (
          s.name.toLowerCase().includes(slashMatch) ||
          (s.description || '').toLowerCase().includes(slashMatch)
        );
      })
    : [];

  useEffect(() => {
    setSlashIndex(0);
  }, [slashMatch]);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  }

  function selectSkill(skillId: string) {
    setText('');
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
    props.onSelectSkill?.(skillId);
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
    if (isSlashMode && matchingSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % matchingSkills.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + matchingSkills.length) % matchingSkills.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault();
        const chosen = matchingSkills[slashIndex];
        if (chosen) {
          selectSkill(chosen.id);
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

      {isSlashMode && matchingSkills.length > 0 && (
        <div className="slash-menu">
          <div className="slash-menu-header">
            <span className="slash-menu-title">⚡ {t('slash.title')}</span>
            <span className="slash-menu-tip">{t('slash.tip')}</span>
          </div>
          <div className="slash-menu-list">
            {matchingSkills.map((s, idx) => (
              <div
                key={s.id}
                className={`slash-menu-item ${idx === slashIndex ? 'active' : ''}`}
                onClick={() => selectSkill(s.id)}
                onMouseEnter={() => setSlashIndex(idx)}
              >
                <span className="slash-item-icon">{s.icon || '⚡'}</span>
                <div className="slash-item-body">
                  <div className="slash-item-name">
                    {s.name}
                    {s.pinned && <span className="skill-pinned-tag">★</span>}
                  </div>
                  {s.description && (
                    <div className="slash-item-desc">{s.description}</div>
                  )}
                </div>
                <span className="slash-item-shortcut">↵</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSlashMode && matchingSkills.length === 0 && (
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
