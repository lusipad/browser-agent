import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutMarks, colorFor } from '../../src/background/marks';

const opts = { vpCssW: 1200, canvasW: 600, canvasH: 400 };

test('layoutMarks: 等比缩放到画布像素', () => {
  const r = layoutMarks([{ ref: '5', x: 100, y: 80, w: 200, h: 40, inView: true, label: 'button' }], opts);
  assert.equal(r.length, 1);
  assert.deepEqual({ bx: r[0].bx, by: r[0].by, bw: r[0].bw, bh: r[0].bh }, { bx: 50, by: 40, bw: 100, bh: 20 });
  assert.equal(r[0].ref, '5');
});

test('layoutMarks: 过滤 offscreen / 过小 / 全屏容器', () => {
  assert.equal(layoutMarks([{ ref: '1', x: 0, y: 0, w: 100, h: 100, inView: false }], opts).length, 0, 'offscreen');
  assert.equal(layoutMarks([{ ref: '1', x: 0, y: 0, w: 8, h: 8, inView: true }], opts).length, 0, '过小(缩放后4px)');
  assert.equal(layoutMarks([{ ref: '1', x: 0, y: 0, w: 1200, h: 800, inView: true }], opts).length, 0, '全屏容器');
});

test('layoutMarks: 越界裁剪到画布', () => {
  const r = layoutMarks([{ ref: '9', x: 1100, y: 700, w: 400, h: 400, inView: true }], opts);
  assert.equal(r.length, 1);
  assert.equal(r[0].bw, 50);
  assert.equal(r[0].bh, 50);
});

test('layoutMarks: cap 限量', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ ref: String(i), x: (i % 30) * 20, y: Math.floor(i / 30) * 30, w: 18, h: 24, inView: true }));
  assert.equal(layoutMarks(many, { ...opts, cap: 60 }).length, 60);
});

test('colorFor: 循环取色', () => {
  assert.equal(colorFor(0), colorFor(6));
  assert.notEqual(colorFor(0), colorFor(1));
});
