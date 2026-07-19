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

// 圆角矩形有符号距离（居中于 cx,cy，半宽/半高 hw/hh，圆角 rr）
function sdRoundRect(px, py, cx, cy, hw, hh, rr) {
  const qx = Math.abs(px - cx) - (hw - rr);
  const qy = Math.abs(py - cy) - (hh - rr);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - rr;
}
// 距离 → 覆盖率（抗锯齿）
function cov(d) {
  return d < -0.5 ? 1 : d < 0.5 ? 0.5 - d : 0;
}

function pixel(x, y, size) {
  const d = roundRectDist(x, y, size);
  if (d >= 0.5) return [0, 0, 0, 0];
  const alpha = d < -0.5 ? 255 : Math.round((0.5 - d) * 255);
  const px = x + 0.5, py = y + 0.5;
  // 对角渐变：靛蓝 → 天蓝
  const t = (x + y) / (2 * size);
  let r = 79 + (14 - 79) * t;
  let g = 70 + (165 - 70) * t;
  let b = 229 + (233 - 229) * t;
  const blend = (nr, ng, nb, c) => {
    if (c <= 0) return;
    r += (nr - r) * c; g += (ng - g) * c; b += (nb - b) * c;
  };
  // 机器人天线（白色小杆 + 圆点），仅较大尺寸
  if (size >= 32) {
    blend(255, 255, 255, cov(sdRoundRect(px, py, size * 0.5, size * 0.28, size * 0.018, size * 0.055, size * 0.015)));
    blend(255, 255, 255, cov(Math.hypot(px - size * 0.5, py - size * 0.2) - size * 0.055));
  }
  // 白色机器人头（圆角方脸）
  blend(255, 255, 255, cov(sdRoundRect(px, py, size * 0.5, size * 0.56, size * 0.27, size * 0.23, size * 0.09)));
  // 两只靛蓝眼睛
  const eyR = size * 0.062;
  blend(79, 70, 229, cov(Math.hypot(px - size * 0.4, py - size * 0.53) - eyR));
  blend(79, 70, 229, cov(Math.hypot(px - size * 0.6, py - size * 0.53) - eyR));
  // 微笑嘴（白底上的靛蓝短横），仅较大尺寸
  if (size >= 48) {
    blend(79, 70, 229, cov(sdRoundRect(px, py, size * 0.5, size * 0.66, size * 0.1, size * 0.018, size * 0.018)));
  }
  return [Math.round(r), Math.round(g), Math.round(b), alpha];
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
