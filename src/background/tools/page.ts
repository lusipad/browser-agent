// 页面语义工具：read_page / find / form_input / get_page_text / scroll_to_ref / file_upload
import { b64FromBytes, truncate } from '../../shared/util';
import { getAllFramesText, runInPage } from '../inject';
import { confirmSensitive } from '../permissions';
import { withAutoShot, type ToolDef } from './registry';

export const pageTools: ToolDef[] = [
  {
    name: 'read_page',
    description:
      'Read the page structure: url/title/scroll position plus a list of interactive elements with stable refs, roles, names, states and center coordinates (css px). ' +
      'Refs can be passed to computer clicks, form_input, scroll_to_ref. Refs become stale after navigation — re-read then. ' +
      'filter "full" also includes the heading outline.',
    schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['interactive', 'full'], description: 'What to include, default "interactive"' },
        max_chars: { type: 'integer', description: 'Max output characters, default 16000' },
        tab_id: { type: 'integer', description: 'Target tab id (defaults to the agent\'s current tab)' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      const r = await runInPage(ctx.tabId, 'read_page', {
        filter: input.filter ?? 'interactive',
        max_chars: Math.min(60000, Math.max(2000, Number(input.max_chars ?? 16000))),
      });
      ctx.session.currentTabId = ctx.tabId;
      return { content: [{ type: 'text', text: String(r?.text ?? '') }] };
    },
  },
  {
    name: 'find',
    description:
      'Search the page for interactive elements matching a text query (matches name/label/href/role). Returns up to 12 elements with refs and coordinates. Faster and cheaper than read_page when you know what you are looking for.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for, e.g. "login button", "搜索"' },
        tab_id: { type: 'integer' },
      },
      required: ['query'],
    },
    needsTab: true,
    async run(ctx, input) {
      const r = await runInPage(ctx.tabId, 'find', { query: String(input.query ?? '') });
      return { content: [{ type: 'text', text: String(r?.text ?? '') }] };
    },
  },
  {
    name: 'form_input',
    description:
      'Set the value of a form element by ref: text inputs/textareas (fires proper input events so React/Vue apps see the change), <select> (matches option by value or text), checkboxes/radios (value "true"/"false"), contenteditable. More reliable than typing for plain form fields.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Element ref from read_page/find' },
        value: { type: 'string', description: 'Value to set; for checkbox/radio use "true" or "false"' },
        tab_id: { type: 'integer' },
      },
      required: ['ref', 'value'],
    },
    needsTab: true,
    async run(ctx, input) {
      const info = await runInPage(ctx.tabId, 'element_info', { ref: input.ref });
      if (info.isPassword) {
        await confirmSensitive(ctx.session, 'password', `智能体想向密码输入框写入内容（${String(input.value ?? '').length} 个字符）。`);
      }
      const r = await runInPage(ctx.tabId, 'form_input', { ref: input.ref, value: input.value });
      return { content: [{ type: 'text', text: String(r?.text ?? 'ok') }] };
    },
  },
  {
    name: 'scroll_to_ref',
    description: 'Scroll an element (by ref) into the center of the viewport. Returns its new coordinates.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string' },
        tab_id: { type: 'integer' },
      },
      required: ['ref'],
    },
    needsTab: true,
    async run(ctx, input) {
      const r = await runInPage(ctx.tabId, 'scroll_to', { ref: input.ref });
      return withAutoShot(ctx.session, ctx.tabId, String(r?.text ?? 'Scrolled.'));
    },
  },
  {
    name: 'get_page_text',
    description:
      'Extract the readable text of the page (all frames, article-style). Use for reading content; use read_page for interacting. Supports offset for paging through long documents.',
    schema: {
      type: 'object',
      properties: {
        max_chars: { type: 'integer', description: 'Max characters returned, default 20000' },
        offset: { type: 'integer', description: 'Character offset to continue from, default 0' },
        tab_id: { type: 'integer' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      const frames = await getAllFramesText(ctx.tabId);
      if (!frames.length) return { content: [{ type: 'text', text: '(page has no readable text)' }] };
      let full = `Title: ${frames[0].title}\nURL: ${frames[0].url}\n\n${frames[0].text}`;
      for (const f of frames.slice(1)) {
        if (f.text.trim()) full += `\n\n----- iframe: ${f.url.slice(0, 120)} -----\n${f.text}`;
      }
      const offset = Math.max(0, Number(input.offset ?? 0));
      const max = Math.min(80000, Math.max(1000, Number(input.max_chars ?? 20000)));
      const slice = full.slice(offset, offset + max);
      const tail =
        offset + max < full.length
          ? `\n…(${full.length - offset - max} more chars — call again with offset=${offset + max})`
          : '';
      return { content: [{ type: 'text', text: slice + tail }] };
    },
  },
  {
    name: 'file_upload',
    description:
      'Upload a file to the page: fetches the file from a URL (http(s) or data:), then attaches it to a file input (by ref) or drops it onto a dropzone element (mode "drop"). Requires user approval.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Ref of the file input or dropzone element' },
        url: { type: 'string', description: 'Source URL of the file (http(s) or data: URI)' },
        filename: { type: 'string', description: 'File name, e.g. "photo.jpg"' },
        mime: { type: 'string', description: 'MIME type; inferred from the response if omitted' },
        mode: { type: 'string', enum: ['change', 'drop'], description: '"change" sets a file input (default); "drop" simulates drag-and-drop' },
        tab_id: { type: 'integer' },
      },
      required: ['ref', 'url'],
    },
    needsTab: true,
    async run(ctx, input) {
      const url = String(input.url ?? '');
      if (!/^(https?:|data:)/.test(url)) throw new Error('file_upload: url must be http(s) or data:');
      await confirmSensitive(
        ctx.session,
        'upload',
        `智能体想把文件 ${String(input.filename ?? url.slice(0, 80))} 上传到当前页面。`,
      );
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch file: HTTP ${resp.status}`);
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) throw new Error('file_upload: file exceeds 8MB limit');
      const mime = String(input.mime ?? resp.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream');
      const name = String(input.filename ?? url.split('/').pop()?.split('?')[0] ?? 'upload.bin');
      const r = await runInPage(ctx.tabId, 'upload', {
        ref: input.ref,
        b64: b64FromBytes(buf),
        name,
        mime,
        mode: input.mode ?? 'change',
      });
      return withAutoShot(ctx.session, ctx.tabId, truncate(String(r?.text ?? 'Uploaded.'), 500));
    },
  },
];
