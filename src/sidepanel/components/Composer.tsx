import { useEffect, useRef, useState } from 'react';
import { useT } from '../../shared/i18nReact';
import type { RegionSnippet } from '../../shared/types';

interface Props {
  running: boolean;
  hasModel: boolean;
  region?: RegionSnippet | null;
  onClearRegion?: () => void;
  onSelectRegion?: () => void;
  onSend: (text: string, region?: RegionSnippet) => void;
  onAbort: () => void;
}

export function Composer(props: Props) {
  const t = useT();
  const [text, setText] = useState('');
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

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  }

  function submit() {
    const t = text.trim();
    if ((!t && !props.region) || props.running) return;
    props.onSend(t, props.region || undefined);
    setText('');
    props.onClearRegion?.();
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
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
