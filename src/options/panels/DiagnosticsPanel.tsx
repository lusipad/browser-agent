import { useState } from 'react';
import type { DiagnosticsReport } from '../../shared/types';
import { useT } from '../../shared/i18nReact';

export function DiagnosticsPanel() {
  const t = useT();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const r = (await chrome.runtime.sendMessage({ type: 'diagnose' })) as DiagnosticsReport;
      setReport(
        r ?? {
          ok: false,
          tab: null,
          checks: [{ name: t('opt.diagnostics.checkName'), status: 'fail', detail: t('opt.diagnostics.noResponse') }],
        },
      );
    } catch (e) {
      setReport({
        ok: false,
        tab: null,
        checks: [{ name: t('opt.diagnostics.checkName'), status: 'fail', detail: e instanceof Error ? e.message : String(e) }],
      });
    } finally {
      setLoading(false);
    }
  }

  const dot = (s: string) => (s === 'ok' ? '●' : s === 'warn' ? '▲' : '✕');

  return (
    <div className="panel">
      <h1>{t('opt.diagnostics.title')}</h1>
      <p className="lead">{t('opt.diagnostics.lead')}</p>

      <button className="btn primary run-diag" onClick={run} disabled={loading}>
        {loading ? t('opt.diagnostics.running') : t('opt.diagnostics.run')}
      </button>

      {report && (
        <div className="card diag-report">
          <div className={'diag-head ' + (report.ok ? 'ok' : 'bad')}>
            {report.ok ? t('opt.diagnostics.allOk') : t('opt.diagnostics.hasIssues')}
            {report.tab && <span className="diag-tab">{report.tab.title || report.tab.url}</span>}
          </div>
          <ul className="diag-list">
            {report.checks.map((c, i) => (
              <li key={i} className={'diag-item ' + c.status}>
                <span className="diag-dot">{dot(c.status)}</span>
                <span className="diag-name">{c.name}</span>
                <span className="diag-detail">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="diag-note">{t('opt.diagnostics.note')}</p>
    </div>
  );
}
