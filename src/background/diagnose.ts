// 一键诊断：对真实标签页跑一遍感知层 + CDP 全链路体检，不需要 agent、不花 API 钱
import type { DiagCheck, DiagnosticsReport } from '../shared/types';
import { errText } from '../shared/util';
import { ensureAttached, networkActivity } from './cdp';
import { runInPage } from './inject';
import { captureScreenshot } from './screenshot';
import { getTab } from './tabs';

function safeOrigin(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
}

export async function runDiagnostics(tabId: number): Promise<DiagnosticsReport> {
  const checks: DiagCheck[] = [];
  let tab: chrome.tabs.Tab;
  try {
    tab = await getTab(tabId);
  } catch {
    return { ok: false, tab: null, checks: [{ name: '目标标签页', status: 'fail', detail: '找不到标签页（可能已关闭）' }] };
  }

  const url = tab.url ?? '';
  const isHttp = /^https?:/.test(url);
  checks.push({ name: '目标标签页', status: isHttp ? 'ok' : 'warn', detail: `${tab.title ?? ''} — ${url || '(空)'}` });
  if (!isHttp) {
    checks.push({ name: '可自动化', status: 'fail', detail: '仅 http(s) 网页可自动化。请切到一个普通网页再诊断。' });
    return { ok: false, tab: { id: tab.id ?? -1, url, title: tab.title ?? '' }, checks };
  }

  // CDP 附加
  try {
    await ensureAttached(tabId);
    checks.push({ name: 'CDP 调试连接', status: 'ok', detail: '已附加（可发送可信输入/截图）' });
  } catch (e) {
    checks.push({ name: 'CDP 调试连接', status: 'fail', detail: errText(e) });
  }

  // 截图
  try {
    const s = await captureScreenshot(tabId, { maxWidth: 1366, quality: 60 });
    checks.push({ name: '截图', status: 'ok', detail: `成功 ${s.w}×${s.h}px` });
  } catch (e) {
    checks.push({ name: '截图', status: 'fail', detail: errText(e) });
  }

  // 元素收集 + 来源分布
  try {
    const c = await runInPage(tabId, 'collect');
    const els: any[] = c?.elements ?? [];
    const by = { top: 0, shadow: 0, iframe: 0 } as Record<string, number>;
    for (const e of els) by[e.src] = (by[e.src] ?? 0) + 1;
    const inView = els.filter((e) => e.inView).length;
    checks.push({
      name: '元素收集',
      status: els.length ? 'ok' : 'warn',
      detail: `共 ${els.length} 个可交互元素（视口内 ${inView}）｜top ${by.top} · shadow ${by.shadow} · iframe ${by.iframe}`,
    });
    checks.push({
      name: 'Shadow DOM 穿透',
      status: by.shadow > 0 ? 'ok' : 'warn',
      detail: by.shadow > 0 ? `发现 ${by.shadow} 个 shadow DOM 内元素` : '本页未发现 shadow DOM 元素（可能本就没有 web components）',
    });
    checks.push({
      name: '同源 iframe 穿透',
      status: by.iframe > 0 ? 'ok' : 'warn',
      detail: by.iframe > 0 ? `发现 ${by.iframe} 个同源 iframe 内元素` : '本页未发现同源 iframe 内元素',
    });
  } catch (e) {
    checks.push({ name: '元素收集', status: 'fail', detail: errText(e) });
  }

  // 帧结构
  try {
    const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
    const origin = safeOrigin(url);
    let cross = 0;
    for (const f of frames) if (f.frameId !== 0 && safeOrigin(f.url) !== origin) cross++;
    checks.push({
      name: '帧结构',
      status: 'ok',
      detail: `${frames.length} 帧｜跨域 ${cross}${cross > 0 ? '（跨域 iframe 内部细粒度元素目前不提取，可用 get_page_text 读文字）' : ''}`,
    });
  } catch {
    checks.push({ name: '帧结构', status: 'warn', detail: '无法读取帧结构（可能缺 webNavigation 权限，重新加载扩展试试）' });
  }

  // 网络状态
  const na = networkActivity(tabId);
  checks.push({
    name: '网络',
    status: 'ok',
    detail: `在途请求 ${na.inFlight}${Number.isFinite(na.sinceLastMs) ? `，距上次活动 ${Math.round(na.sinceLastMs)}ms` : ''}`,
  });

  const ok = !checks.some((c) => c.status === 'fail');
  return { ok, tab: { id: tab.id ?? -1, url, title: tab.title ?? '' }, checks };
}

/** 选择要诊断的标签页：优先当前活动的 http(s) 页，其次最近访问过的 */
export async function pickDiagnoseTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({});
  const http = tabs.filter((t) => t.id != null && /^https?:/.test(t.url ?? ''));
  if (!http.length) return null;
  http.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  return http[0].id ?? null;
}
