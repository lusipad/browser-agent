import { useRef, useState } from 'react';

interface Props {
  running: boolean;
  hasModel: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
}

export function Composer(props: Props) {
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
        placeholder={props.hasModel ? '让智能体做点什么…（Enter 发送，Shift+Enter 换行）' : '请先在设置中配置模型和 API Key'}
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
        <button className="send-btn stop" onClick={props.onAbort} title="停止">
          ■
        </button>
      ) : (
        <button className="send-btn" onClick={submit} disabled={!text.trim() || !props.hasModel} title="发送">
          ↑
        </button>
      )}
    </div>
  );
}
