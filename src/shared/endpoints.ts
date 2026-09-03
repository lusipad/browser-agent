/** 为常见 OpenAI 兼容服务生成主路径和 /v1 备用路径。 */
export function endpointUrls(baseUrl: string, path: string): string[] {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return [];
  const withoutV1 = base.replace(/\/v1$/i, '');
  const bases = /\/v1$/i.test(base) ? [base, withoutV1] : [base, `${base}/v1`];
  return [...new Set(bases.filter(Boolean))].map((item) => `${item}/${path.replace(/^\/+/, '')}`);
}
