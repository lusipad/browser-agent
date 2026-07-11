import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionMet } from '../../src/background/tools/page';

test('conditionMet: appear 依据匹配数', () => {
  assert.equal(conditionMet('appear', { matchCount: 3, textFound: false }), true);
  assert.equal(conditionMet('appear', { matchCount: 0, textFound: false }), false);
});

test('conditionMet: disappear 依据零匹配', () => {
  assert.equal(conditionMet('disappear', { matchCount: 0, textFound: false }), true);
  assert.equal(conditionMet('disappear', { matchCount: 2, textFound: false }), false);
});

test('conditionMet: text 依据文本命中', () => {
  assert.equal(conditionMet('text', { matchCount: 0, textFound: true }), true);
  assert.equal(conditionMet('text', { matchCount: 9, textFound: false }), false);
});

test('conditionMet: 未知条件为 false', () => {
  assert.equal(conditionMet('bogus', { matchCount: 9, textFound: true }), false);
});
