import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostMatches, hostnameOf, truncate, b64FromBytes, bytesFromB64, textOfBlocks, errText } from '../../src/shared/util';

test('hostMatches: 精确与子域', () => {
  assert.ok(hostMatches('example.com', 'example.com'));
  assert.ok(hostMatches('www.example.com', 'example.com'));
  assert.ok(hostMatches('a.b.example.com', 'example.com'));
  assert.ok(!hostMatches('notexample.com', 'example.com'));
  assert.ok(!hostMatches('example.com.evil.com', 'example.com'));
});

test('hostMatches: 通配与协议前缀被规整', () => {
  assert.ok(hostMatches('sub.example.com', '*.example.com'));
  assert.ok(hostMatches('example.com', 'https://example.com/path'));
  assert.ok(!hostMatches('example.com', ''));
});

test('hostnameOf: 解析与容错', () => {
  assert.equal(hostnameOf('https://Example.com/x'), 'example.com');
  assert.equal(hostnameOf('not a url'), null);
  assert.equal(hostnameOf(null), null);
});

test('truncate: 超长截断并附注', () => {
  assert.equal(truncate('hello', 10), 'hello');
  assert.equal(truncate('hello world', 5, '…'), 'hello…');
});

test('base64 往返', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
  assert.deepEqual(Array.from(bytesFromB64(b64FromBytes(bytes))), Array.from(bytes));
});

test('base64 大数组不栈溢出', () => {
  const big = new Uint8Array(100000).map((_, i) => i % 256);
  assert.equal(bytesFromB64(b64FromBytes(big)).length, 100000);
});

test('textOfBlocks: 仅取文本块', () => {
  const blocks: any = [
    { type: 'text', text: 'a' },
    { type: 'image', mediaType: 'image/jpeg', data: 'x' },
    { type: 'text', text: 'b' },
  ];
  assert.equal(textOfBlocks(blocks), 'a\nb');
});

test('errText: Error 与非 Error', () => {
  assert.equal(errText(new Error('boom')), 'boom');
  assert.equal(errText('plain'), 'plain');
});
