import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeT, resolveLang, translate } from '../../src/shared/i18n';

test('translate: 中英取对应语言', () => {
  assert.equal(translate('zh', 'header.settings'), '设置');
  assert.equal(translate('en', 'header.settings'), 'Settings');
});

test('translate: 参数插值 {0}{1}', () => {
  assert.equal(translate('en', 'history.msgCount', [3]), '3 msgs');
  assert.match(translate('zh', 'bg.detach', [2, 1]), /断开 2 .*撤销 1 /);
  assert.match(translate('zh', 'bg.emptyResponse', ['gpt-test']), /gpt-test.*测试连接/);
});

test('translate: 未知 key 回落为 key 本身（供 toolLabel 探测缺失）', () => {
  assert.equal(translate('en', 'tool.__nope__' as any), 'tool.__nope__');
});

test('resolveLang: auto 跟随浏览器，显式覆盖', () => {
  assert.equal(resolveLang('zh'), 'zh');
  assert.equal(resolveLang('en'), 'en');
  // auto → detectLang()（Node 无 navigator → 回落 en）
  assert.equal(['zh', 'en'].includes(resolveLang('auto')), true);
  assert.equal(['zh', 'en'].includes(resolveLang(undefined)), true);
});

test('makeT: 绑定语言', () => {
  const t = makeT('en');
  assert.equal(t('composer.send'), 'Send');
  assert.equal(t('history.msgCount', [5]), '5 msgs');
});
