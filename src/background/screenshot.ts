// 截图：CDP 捕获（无需标签页聚焦）→ 缩放到 CSS 像素坐标空间 → JPEG 压缩
import { b64FromBytes, bytesFromB64 } from '../shared/util';
import { ensureAttached, evalInPage, send } from './cdp';

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
}

export async function captureScreenshot(
  tabId: number,
  opts: { maxWidth: number; quality: number },
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
    };
  } finally {
    bitmap.close();
  }
}

/** 模型给出的截图坐标 → 页面 CSS 坐标 */
export function imageToCss(tabId: number, x: number, y: number): { x: number; y: number } {
  const s = lastShot.get(tabId)?.scale ?? 1;
  return { x: Math.round(x * s), y: Math.round(y * s) };
}
