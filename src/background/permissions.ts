// 站点级授权 + 敏感操作确认（复刻 Claude in Chrome 的权限模型）
import { saveConfig } from '../shared/settings';
import type { AppConfig, ApprovalDecision } from '../shared/types';
import { hostMatches } from '../shared/util';

/** Session 提供给权限层的最小接口（避免循环依赖） */
export interface ApprovalHost {
  cfg: AppConfig;
  /** 本次对话中临时放行的域名 */
  tempAllowedHosts: Set<string>;
  requestApproval(req: { title: string; description: string; siteOption?: boolean }): Promise<ApprovalDecision>;
}

export function isBlockedHost(cfg: AppConfig, host: string): boolean {
  return cfg.sites.blocked.some((p) => hostMatches(host, p));
}

export function isAllowedHost(cfg: AppConfig, host: string, temp: Set<string>): boolean {
  return (
    cfg.safety.allowAllSites || temp.has(host) || cfg.sites.allowed.some((p) => hostMatches(host, p))
  );
}

/**
 * 确保允许在 url 上操作；未授权时弹出面板内批准卡片。
 * 拒绝 / 命中黑名单 / 浏览器内置页面 → 抛错（作为工具错误返回给模型）。
 */
export async function ensureSiteAllowed(host: ApprovalHost, url: string | undefined, purpose: string): Promise<void> {
  if (!url || url === 'about:blank' || url.startsWith('about:')) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Cannot operate on ${parsed.protocol}// pages (browser-internal or local). Navigate to an http(s) website instead.`,
    );
  }
  const h = parsed.hostname.toLowerCase();
  if (isBlockedHost(host.cfg, h)) {
    throw new Error(`Site "${h}" is on the user's blocklist. You must not operate on it — inform the user.`);
  }
  if (isAllowedHost(host.cfg, h, host.tempAllowedHosts)) return;
  if (!host.cfg.safety.confirmNewSite) {
    host.tempAllowedHosts.add(h);
    return;
  }
  const d = await host.requestApproval({
    title: `允许在 ${h} 上操作？`,
    description: `智能体请求${purpose}。「始终允许」会把该站点加入允许列表；「仅本次」在本对话内有效。`,
    siteOption: true,
  });
  if (d === 'deny') {
    throw new Error(`User denied access to "${h}". Do not retry this site; ask the user how to proceed.`);
  }
  host.tempAllowedHosts.add(h);
  if (d === 'allow_site') {
    if (!host.cfg.sites.allowed.includes(h)) host.cfg.sites.allowed.push(h);
    await saveConfig(host.cfg);
  }
}

/** 敏感动作确认（密码输入 / JS 执行 / 文件上传等） */
export async function confirmSensitive(
  host: ApprovalHost,
  kind: 'password' | 'javascript' | 'upload',
  description: string,
): Promise<void> {
  const need =
    (kind === 'password' && host.cfg.safety.confirmPassword) ||
    (kind === 'javascript' && host.cfg.safety.confirmJavascript) ||
    (kind === 'upload' && host.cfg.safety.confirmUpload);
  if (!need) return;
  const titles: Record<typeof kind, string> = {
    password: '允许向密码框输入内容？',
    javascript: '允许在页面中执行 JavaScript？',
    upload: '允许上传文件？',
  };
  const d = await host.requestApproval({ title: titles[kind], description });
  if (d === 'deny') {
    throw new Error(`User denied the ${kind} action. Do not retry; ask the user how to proceed.`);
  }
}
