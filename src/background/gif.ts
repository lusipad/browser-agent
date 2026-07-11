// 用 gifenc 把会话截图帧编码为 GIF（在 Service Worker 中通过 OffscreenCanvas 处理像素）
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { bytesFromB64 } from '../shared/util';

export interface GifFrame {
  data: string; // base64 jpeg
  mediaType: string;
}

export async function encodeGif(frames: GifFrame[], targetW = 640, delayMs = 900): Promise<Uint8Array> {
  if (!frames.length) throw new Error('No frames to encode');
  const enc = GIFEncoder();
  let w = 0;
  let h = 0;
  for (const f of frames) {
    const bitmap = await createImageBitmap(new Blob([bytesFromB64(f.data) as BlobPart], { type: f.mediaType }));
    if (!w) {
      w = Math.min(targetW, bitmap.width);
      h = Math.max(1, Math.round((w * bitmap.height) / bitmap.width));
    }
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas unavailable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    // 所有帧拉伸到第一帧的尺寸，保证 GIF 合法
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    enc.writeFrame(index, w, h, { palette, delay: delayMs });
  }
  enc.finish();
  return enc.bytes();
}
