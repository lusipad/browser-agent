// 无依赖 PNG 图标生成器：圆角渐变方块 + 白色“光标”圆点
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function be32(n) {
  return Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function chunk(type, data) {
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  return Buffer.concat([be32(data.length), td, be32(crc32(td))]);
}

/** px(x, y) -> [r, g, b, a] */
function png(w, h, px) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.concat([be32(w), be32(h), Buffer.from([8, 6, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 圆角矩形 SDF（signed distance field），用于抗锯齿边缘
function roundRectDist(x, y, size) {
  const half = size / 2;
  const r = size * 0.24;
  const qx = Math.abs(x - half + 0.5) - (half - r - size * 0.03);
  const qy = Math.abs(y - half + 0.5) - (half - r - size * 0.03);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
}

function pixel(x, y, size) {
  const d = roundRectDist(x, y, size);
  if (d >= 0.5) return [0, 0, 0, 0];
  const alpha = d < -0.5 ? 255 : Math.round((0.5 - d) * 255);
  // 对角渐变：靛蓝 → 天蓝
  const t = (x + y) / (2 * size);
  let r = Math.round(79 + (14 - 79) * t);
  let g = Math.round(70 + (165 - 70) * t);
  let b = Math.round(229 + (233 - 229) * t);
  // 白色圆点（光标示意）
  const cx = size * 0.5, cy = size * 0.44, cr = size * 0.17;
  const dd = Math.hypot(x - cx + 0.5, y - cy + 0.5) - cr;
  if (dd < 0.5) {
    const w = dd < -0.5 ? 1 : 0.5 - dd;
    r = Math.round(r + (255 - r) * w);
    g = Math.round(g + (255 - g) * w);
    b = Math.round(b + (255 - b) * w);
  }
  // 底部白色小横条（面板示意）
  const byTop = size * 0.68, byBot = size * 0.76, bxL = size * 0.3, bxR = size * 0.7;
  if (y >= byTop && y <= byBot && x >= bxL && x <= bxR && size >= 32) {
    r = Math.round(r + (255 - r) * 0.9);
    g = Math.round(g + (255 - g) * 0.9);
    b = Math.round(b + (255 - b) * 0.9);
  }
  return [r, g, b, alpha];
}

export function genIcons(dir) {
  mkdirSync(dir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(join(dir, `icon${size}.png`), png(size, size, (x, y) => pixel(x, y, size)));
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gen-icons.mjs')) {
  genIcons('public/icons');
  console.log('图标已生成 → public/icons/');
}
