// 截图：CDP 捕获（无需标签页聚焦）→ 缩放到 CSS 像素坐标空间 →（可选）set-of-marks 标注 → JPEG 压缩
import { b64FromBytes, bytesFromB64 } from '../shared/util';
import { ensureAttached, evalInPage, send } from './cdp';
import { colorFor, layoutMarks, type BoxMark, type RawMark } from './marks';

export interface Viewport {
  iw: number;
  ih: number;
  dpr: number;
  sx: number;
  sy: number;
  dw: number;
  dh: number;
}

export async function getViewport(tabId: number): Promise<Viewport> {
  const v = await evalInPage(
    tabId,
    '({iw:innerWidth,ih:innerHeight,dpr:devicePixelRatio,sx:Math.round(scrollX),sy:Math.round(scrollY),dw:document.documentElement.scrollWidth,dh:document.documentElement.scrollHeight})',
  );
  if (!v || typeof v.iw !== 'number') throw new Error('Failed to read page viewport');
  return v as Viewport;
}

/** 记录每个标签页最近一次截图的 图像像素→CSS像素 换算系数 */
const lastShot = new Map<number, { scale: number; w: number; h: number }>();

export interface Shot {
  data: string; // base64
  mediaType: string;
  w: number;
  h: number;
  cssW: number;
  cssH: number;
  scrollY: number;
  docH: number;
  marks: BoxMark[]; // 实际画上去的编号框
}

export async function captureScreenshot(
  tabId: number,
  opts: { maxWidth: number; quality: number; marks?: RawMark[] },
): Promise<Shot> {
  await ensureAttached(tabId);
  const vp = await getViewport(tabId);
  const shot = await send(tabId, 'Page.captureScreenshot', { format: 'jpeg', quality: 90 });
  if (!shot?.data) throw new Error('Screenshot capture returned no data');

  const bytes = bytesFromB64(String(shot.data));
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  try {
    const targetW = Math.max(1, Math.min(vp.iw, opts.maxWidth));
    const targetH = Math.max(1, Math.round((targetW * bitmap.height) / bitmap.width));
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    let marks: BoxMark[] = [];
    if (opts.marks && opts.marks.length) {
      marks = layoutMarks(opts.marks, { vpCssW: vp.iw, canvasW: targetW, canvasH: targetH });
      drawMarks(ctx, marks);
    }

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: Math.min(1, Math.max(0.3, opts.quality / 100)),
    });
    const data = b64FromBytes(new Uint8Array(await blob.arrayBuffer()));
    lastShot.set(tabId, { scale: vp.iw / targetW, w: targetW, h: targetH });
    return {
      data,
      mediaType: 'image/jpeg',
      w: targetW,
      h: targetH,
      cssW: vp.iw,
      cssH: vp.ih,
      scrollY: vp.sy,
      docH: vp.dh,
      marks,
    };
  } finally {
    bitmap.close();
  }
}

function drawMarks(ctx: OffscreenCanvasRenderingContext2D, marks: BoxMark[]): void {
  ctx.lineWidth = 2;
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  marks.forEach((m, i) => {
    const color = colorFor(i);
    ctx.strokeStyle = color;
    ctx.strokeRect(m.bx + 1, m.by + 1, Math.max(1, m.bw - 2), Math.max(1, m.bh - 2));
    // 编号标签：优先框内左上角，顶部空间不足则放到框下沿
    const text = m.ref;
    const lw = ctx.measureText(text).width + 6;
    const lh = 15;
    const lx = m.bx;
    const ly = m.by < lh ? m.by + m.bh : m.by;
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, lx + 3, ly + 1);
  });
}

/** 模型给出的截图坐标 → 页面 CSS 坐标 */
export function imageToCss(tabId: number, x: number, y: number): { x: number; y: number } {
  const s = lastShot.get(tabId)?.scale ?? 1;
  return { x: Math.round(x * s), y: Math.round(y * s) };
}

/** 标签页关闭时清理截图换算缓存 */
export function clearScreenshotState(tabId: number): void {
  lastShot.delete(tabId);
}

chrome.tabs?.onRemoved?.addListener?.((tabId) => {
  clearScreenshotState(tabId);
});


