import { useState } from 'react';
import type { DiagnosticsReport } from '../../shared/types';

export function DiagnosticsPanel() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setReport(null);
    try {
      const r = (await chrome.runtime.sendMessage({ type: 'diagnose' })) as DiagnosticsReport;
      setReport(r ?? { ok: false, tab: null, checks: [{ name: '诊断', status: 'fail', detail: '后台无响应，请重新加载扩展。' }] });
    } catch (e) {
      setReport({ ok: false, tab: null, checks: [{ name: '诊断', status: 'fail', detail: e instanceof Error ? e.message : String(e) }] });
    } finally {
      setLoading(false);
    }
  }

  const dot = (s: string) => (s === 'ok' ? '●' : s === 'warn' ? '▲' : '✕');

  return (
    <div className="panel">
      <h1>诊断</h1>
      <p className="lead">
        对你当前正在看的**真实网页**一键体检感知层与 CDP 全链路——CDP 附加、截图、元素收集（含 Shadow DOM / iframe 穿透分布）、帧结构、网络状态。
        无需对话、不花 API 费用。想验证某个具体页面的兼容性时，先在浏览器里打开它、切到该标签页，再回来点下面的按钮。
      </p>

      <button className="btn primary run-diag" onClick={run} disabled={loading}>
        {loading ? '诊断中…' : '▶ 诊断当前标签页'}
      </button>

      {report && (
        <div className="card diag-report">
          <div className={'diag-head ' + (report.ok ? 'ok' : 'bad')}>
            {report.ok ? '✓ 全链路正常' : '存在需要关注的项'}
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

      <p className="diag-note">
        提示：诊断会用 CDP 附加到目标标签页并短暂显示 Chrome 的调试横幅，属正常现象。若「Shadow DOM 穿透 / 同源 iframe 穿透」显示未发现，可能只是该页面本就没有对应结构——换个已知用 web components 的站点（如 youtube.com）再试。
      </p>
    </div>
  );
}
