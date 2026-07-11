// gif_creator：把本次对话捕获的截图帧编码为 GIF 并下载
import { b64FromBytes } from '../../shared/util';
import { encodeGif } from '../gif';
import type { ToolDef } from './registry';

export const gifTool: ToolDef = {
  name: 'gif_creator',
  description:
    "Create an animated GIF from the screenshots captured during this conversation (up to the last 30 frames) and save it to the user's Downloads folder. " +
    'Capture extra screenshots before and after key actions for smoother playback. Name the file meaningfully (e.g. "login_process.gif").',
  schema: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Output file name, e.g. "login_process.gif"' },
      delay_ms: { type: 'integer', description: 'Per-frame delay in ms, default 900' },
    },
  },
  needsTab: false,
  async run(ctx, input) {
    const frames = ctx.session.gifFrames;
    if (frames.length < 2) {
      throw new Error(`Only ${frames.length} screenshot frame(s) captured so far — take more screenshots first.`);
    }
    const delay = Math.min(3000, Math.max(200, Number(input.delay_ms ?? 900)));
    const bytes = await encodeGif(frames, 640, delay);
    let name = String(input.filename ?? 'browser-agent.gif').replace(/[\\/:*?"<>|]/g, '_');
    if (!name.toLowerCase().endsWith('.gif')) name += '.gif';
    const url = 'data:image/gif;base64,' + b64FromBytes(bytes);
    const downloadId = await chrome.downloads.download({ url, filename: name });
    return {
      content: [
        {
          type: 'text',
          text: `GIF with ${frames.length} frames (${Math.round(bytes.length / 1024)}KB) saved to Downloads as "${name}" (download id ${downloadId}).`,
        },
      ],
    };
  },
};
