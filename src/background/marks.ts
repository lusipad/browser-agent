// set-of-marks 纯几何：把元素的顶层 CSS 像素矩形映射到截图画布像素，
// 过滤掉不可见 / 过小 / 近乎全屏的容器框，并限量。无 DOM/Canvas 依赖，可单测。

export interface RawMark {
  ref: string;
  x: number; // 顶层文档视口 CSS px（left/top）
  y: number;
  w: number;
  h: number;
  inView: boolean;
  label?: string;
}

export interface BoxMark {
  ref: string;
  bx: number; // 画布像素
  by: number;
  bw: number;
  bh: number;
  label: string;
}

export interface LayoutOpts {
  vpCssW: number; // 视口 CSS 宽
  canvasW: number; // 画布像素宽
  canvasH: number; // 画布像素高
  cap?: number; // 最多标注数量
}

/**
 * 映射规则：画布是把 vpCssW 宽的视口等比缩放到 canvasW，故 scale = canvasW / vpCssW，
 * x/y/w/h 同乘该系数即得画布像素。
 */
export function layoutMarks(marks: RawMark[], opts: LayoutOpts): BoxMark[] {
  const cap = opts.cap ?? 60;
  const scale = opts.canvasW / Math.max(1, opts.vpCssW);
  const canvasArea = opts.canvasW * opts.canvasH;
  const out: BoxMark[] = [];
  for (const m of marks) {
    if (!m.inView) continue;
    let bx = m.x * scale;
    let by = m.y * scale;
    let bw = m.w * scale;
    let bh = m.h * scale;
    // 裁剪到画布范围
    const rx = Math.min(opts.canvasW, bx + bw);
    const ry = Math.min(opts.canvasH, by + bh);
    bx = Math.max(0, bx);
    by = Math.max(0, by);
    bw = rx - bx;
    bh = ry - by;
    if (bw < 6 || bh < 6) continue; // 太小，标注反而添乱
    if (bw * bh > canvasArea * 0.8) continue; // 近乎全屏，多半是容器
    out.push({ ref: m.ref, bx: Math.round(bx), by: Math.round(by), bw: Math.round(bw), bh: Math.round(bh), label: m.label ?? m.ref });
    if (out.length >= cap) break;
  }
  return out;
}

/** 编号框配色（交替，区分相邻框） */
export const MARK_COLORS = ['#e53935', '#1e88e5', '#43a047', '#8e24aa', '#fb8c00', '#00897b'];

export function colorFor(index: number): string {
  return MARK_COLORS[index % MARK_COLORS.length];
}
