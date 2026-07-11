import type { ContentBlock, TextBlock } from './types';

let uidSeq = 0;

export function uid(prefix = 'id'): string {
  uidSeq = (uidSeq + 1) % 0xffff;
  return `${prefix}_${Date.now().toString(36)}${uidSeq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function truncate(s: string, max: number, note = '\n…（内容已截断）'): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + note;
}

export function hostnameOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** 域名后缀匹配（带点边界）：pattern 支持 "example.com" 或 "*.example.com" */
export function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase().replace(/^\*\./, '').replace(/^https?:\/\//, '').split('/')[0];
  if (!p) return false;
  const h = host.toLowerCase();
  return h === p || h.endsWith('.' + p);
}

export function textOfBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

/** Uint8Array -> base64（分块避免栈溢出） */
export function b64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

export function bytesFromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 把未知错误变成可读字符串 */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
