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
