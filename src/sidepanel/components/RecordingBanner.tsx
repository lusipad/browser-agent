import { useT } from '../../shared/i18nReact';

interface Props {
  recording: boolean;
  count: number;
  lastAction?: string;
  onFinish: () => void;
  onCancel: () => void;
}

export function RecordingBanner({ recording, count, lastAction, onFinish, onCancel }: Props) {
  const t = useT();

  if (!recording) return null;

  return (
    <div className="recording-banner">
      <div className="recording-banner-left">
        <span className="recording-dot pulse" />
        <div className="recording-info">
          <div className="recording-title">
            <span className="recording-badge">{t('skill.recordingTitle')}</span>
            <span className="recording-count">{t('skill.recordingActions', [count])}</span>
          </div>
          {lastAction && <div className="recording-last" title={lastAction}>{lastAction}</div>}
        </div>
      </div>
      <div className="recording-banner-actions">
        <button
          className="btn primary recording-finish-btn"
          disabled={count === 0}
          title={count === 0 ? '请先在网页中操作以捕获动作' : t('skill.finishTeach')}
          onClick={onFinish}
        >
          ⏹ {t('skill.finishTeach')}
        </button>
        <button
          className="btn secondary recording-cancel-btn"
          title={t('skill.cancelTeach')}
          onClick={onCancel}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
