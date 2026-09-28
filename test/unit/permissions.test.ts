import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedHost, isAllowedHost } from '../../src/background/permissions';
import type { AppConfig } from '../../src/shared/types';

const cfg = {
  safety: { allowAllSites: false },
  sites: { allowed: ['example.com', '*.trusted.org'], blocked: ['bank.com', 'pay.evil.com'] },
} as unknown as AppConfig;

test('isBlockedHost: 精确与子域', () => {
  assert.ok(isBlockedHost(cfg, 'bank.com'));
  assert.ok(isBlockedHost(cfg, 'login.bank.com'));
  assert.ok(!isBlockedHost(cfg, 'notbank.com'));
});

test('isAllowedHost: 白名单精确 + 通配子域', () => {
  const temp = new Set<string>();
  assert.ok(isAllowedHost(cfg, 'example.com', temp));
  assert.ok(isAllowedHost(cfg, 'www.example.com', temp));
  assert.ok(isAllowedHost(cfg, 'a.trusted.org', temp));
  assert.ok(!isAllowedHost(cfg, 'other.com', temp));
});

test('isAllowedHost: 临时放行集合', () => {
  const temp = new Set<string>(['temp.com']);
  assert.ok(isAllowedHost(cfg, 'temp.com', temp));
  assert.ok(!isAllowedHost(cfg, 'temp2.com', temp));
});

test('isAllowedHost: allowAllSites 全放行', () => {
  const open = { safety: { allowAllSites: true }, sites: { allowed: [], blocked: [] } } as unknown as AppConfig;
  assert.ok(isAllowedHost(open, 'anything.com', new Set()));
});

test('isAllowedHost: allowAllHttps 仅放行 https，不放行不加密 http', () => {
  const httpsOnly = {
    safety: { allowAllSites: false },
    sites: { allowed: [], blocked: ['bank.com'], allowAllHttps: true },
  } as unknown as AppConfig;

  // https 任意站点自动放行
  assert.ok(isAllowedHost(httpsOnly, 'github.com', new Set(), 'https:'));
  assert.ok(isAllowedHost(httpsOnly, 'wikipedia.org', new Set(), 'https:'));

  // http 不加密站点不自动放行
  assert.ok(!isAllowedHost(httpsOnly, 'insecure.org', new Set(), 'http:'));
  assert.ok(!isAllowedHost(httpsOnly, 'insecure.org', new Set()));

  // 命中黑名单依然被阻止
  assert.ok(isBlockedHost(httpsOnly, 'bank.com'));
});

