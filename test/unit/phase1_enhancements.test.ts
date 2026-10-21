import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionMet } from '../../src/background/tools/page';
import { getOpenDialog, handleDialog } from '../../src/background/cdp';

test('conditionMet: text_gone 条件判断', () => {
  // 当 textFound 为 false 时（文本已消失），text_gone 判定为 true
  assert.equal(conditionMet('text_gone', { matchCount: 0, textFound: false }), true);
  // 当 textFound 为 true 时（文本仍存在），text_gone 判定为 false
  assert.equal(conditionMet('text_gone', { matchCount: 0, textFound: true }), false);
});

test('CDP dialog: 默认无打开弹窗', () => {
  const dialog = getOpenDialog(99999);
  assert.equal(dialog, null);
});
