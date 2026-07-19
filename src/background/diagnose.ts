// 一键诊断：对真实标签页跑一遍感知层 + CDP 全链路体检，不需要 agent、不花 API 钱
import { makeT, type Lang } from '../shared/i18n';
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

export async function runDiagnostics(tabId: number, lang: Lang = 'zh'): Promise<DiagnosticsReport> {
  const t = makeT(lang);
  const checks: DiagCheck[] = [];
  let tab: chrome.tabs.Tab;
  try {
    tab = await getTab(tabId);
  } catch {
    return { ok: false, tab: null, checks: [{ name: t('bg.diag.targetTab'), status: 'fail', detail: t('bg.diag.tabGone') }] };
  }

  const url = tab.url ?? '';
  const isHttp = /^https?:/.test(url);
  checks.push({ name: t('bg.diag.targetTab'), status: isHttp ? 'ok' : 'warn', detail: `${tab.title ?? ''} — ${url || t('bg.diag.empty')}` });
  if (!isHttp) {
    checks.push({ name: t('bg.diag.automatable'), status: 'fail', detail: t('bg.diag.httpOnly') });
    return { ok: false, tab: { id: tab.id ?? -1, url, title: tab.title ?? '' }, checks };
  }

  // CDP 附加
  try {
    await ensureAttached(tabId);
    checks.push({ name: t('bg.diag.cdp'), status: 'ok', detail: t('bg.diag.cdpOk') });
  } catch (e) {
    checks.push({ name: t('bg.diag.cdp'), status: 'fail', detail: errText(e) });
  }

  // 截图
  try {
    const s = await captureScreenshot(tabId, { maxWidth: 1366, quality: 60 });
    checks.push({ name: t('bg.diag.screenshot'), status: 'ok', detail: t('bg.diag.shotOk', [s.w, s.h]) });
  } catch (e) {
    checks.push({ name: t('bg.diag.screenshot'), status: 'fail', detail: errText(e) });
  }

  // 元素收集 + 来源分布
  try {
    const c = await runInPage(tabId, 'collect');
    const els: any[] = c?.elements ?? [];
    const by = { top: 0, shadow: 0, iframe: 0 } as Record<string, number>;
    for (const e of els) by[e.src] = (by[e.src] ?? 0) + 1;
    const inView = els.filter((e) => e.inView).length;
    checks.push({
      name: t('bg.diag.collect'),
      status: els.length ? 'ok' : 'warn',
      detail: t('bg.diag.collectDetail', [els.length, inView, by.top, by.shadow, by.iframe]),
    });
    checks.push({
      name: t('bg.diag.shadow'),
      status: by.shadow > 0 ? 'ok' : 'warn',
      detail: by.shadow > 0 ? t('bg.diag.shadowFound', [by.shadow]) : t('bg.diag.shadowNone'),
    });
    checks.push({
      name: t('bg.diag.iframe'),
      status: by.iframe > 0 ? 'ok' : 'warn',
      detail: by.iframe > 0 ? t('bg.diag.iframeFound', [by.iframe]) : t('bg.diag.iframeNone'),
    });
  } catch (e) {
    checks.push({ name: t('bg.diag.collect'), status: 'fail', detail: errText(e) });
  }

  // 帧结构
  try {
    const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
    const origin = safeOrigin(url);
    let cross = 0;
    for (const f of frames) if (f.frameId !== 0 && safeOrigin(f.url) !== origin) cross++;
    checks.push({
      name: t('bg.diag.frames'),
      status: 'ok',
      detail: t('bg.diag.framesDetail', [frames.length, cross, cross > 0 ? t('bg.diag.crossNote') : '']),
    });
  } catch {
    checks.push({ name: t('bg.diag.frames'), status: 'warn', detail: t('bg.diag.framesFail') });
  }

  // 网络状态
  const na = networkActivity(tabId);
  checks.push({
    name: t('bg.diag.network'),
    status: 'ok',
    detail: Number.isFinite(na.sinceLastMs)
      ? t('bg.diag.networkDetail', [na.inFlight, Math.round(na.sinceLastMs)])
      : t('bg.diag.networkBrief', [na.inFlight]),
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
