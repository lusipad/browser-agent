import { useRef, useState } from 'react';
import { useT } from '../../shared/i18nReact';

interface Props {
  running: boolean;
  hasModel: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
}

export function Composer(props: Props) {
  const t = useT();
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
  }

  function submit() {
    const t = text.trim();
    if (!t || props.running) return;
    props.onSend(t);
    setText('');
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = 'auto';
    });
  }

  return (
    <div className="composer">
      <textarea
        ref={taRef}
        className="input"
        value={text}
        placeholder={props.hasModel ? t('composer.placeholder') : t('composer.needModel')}
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
        <button className="send-btn" onClick={submit} disabled={!text.trim() || !props.hasModel} title={t('composer.send')}>
          ↑
        </button>
      )}
    </div>
  );
}
