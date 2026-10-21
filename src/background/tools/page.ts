// 页面语义工具：read_page / find / form_input / get_page_text / scroll_to_ref / file_upload / wait_for
import { b64FromBytes, sleep, truncate } from '../../shared/util';
import { getAllFramesText, runInPage } from '../inject';
import { confirmSensitive } from '../permissions';
import { withAutoShot, type ToolDef } from './registry';

/** wait_for 条件判定（纯函数，便于单测） */
export function conditionMet(condition: string, r: { matchCount: number; textFound: boolean }): boolean {
  switch (condition) {
    case 'appear':
      return r.matchCount > 0;
    case 'disappear':
      return r.matchCount === 0;
    case 'text':
      return r.textFound;
    case 'text_gone':
      return !r.textFound;
    default:
      return false;
  }
}

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
    name: 'extract_data',
    description:
      'Extract STRUCTURED data from the page (across shadow DOM and same-origin iframes) as JSON — cheaper and more precise than reading the whole page text, and easier to summarise. ' +
      'Modes: "auto_cards" = auto-detects repeating card/list items (e-commerce products, search results, news feeds) and extracts title/price/link/image/text; ' +
      '"tables" = every <table> as {caption, headers, rows}; "links" = all links as {text, href}; ' +
      '"selector" = provide a CSS "selector" and each matching element becomes one record — its trimmed text by default, or if "fields" is given, an object whose values are sub-selectors relative to the match. ' +
      'A field value may be "subSelector@attr" or just "@attr" to read an attribute (e.g. "@href", "img@src", "a.title@href").',
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['auto_cards', 'tables', 'links', 'selector'], description: 'Extraction mode, default "auto_cards" (or "tables" if tables exist, or "selector" if a selector is given)' },
        selector: { type: 'string', description: 'CSS selector for the repeating record container (selector mode), e.g. "li.product", ".search-result"' },
        fields: {
          type: 'object',
          description: 'Map fieldName -> sub-selector (optionally "sel@attr" or "@attr"). Omit to return each match\'s text.',
          additionalProperties: { type: 'string' },
        },
        max_chars: { type: 'integer', description: 'Max JSON characters returned, default 12000' },
        tab_id: { type: 'integer' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      const r = await runInPage(ctx.tabId, 'extract', {
        mode: input.mode,
        selector: input.selector,
        fields: input.fields,
      });
      ctx.session.currentTabId = ctx.tabId;
      const max = Math.min(40000, Math.max(1000, Number(input.max_chars ?? 12000)));
      const json = JSON.stringify(r ?? {}, null, 0);
      const text = json.length > max ? json.slice(0, max) + `\n…(truncated; ${json.length - max} more chars — narrow the selector or use max_chars/offset)` : json;
      return { content: [{ type: 'text', text }] };
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
        await confirmSensitive(ctx.session, 'password', ctx.session.t('bg.confirmPasswordDesc', [String(input.value ?? '').length]));
      }
      void runInPage(ctx.tabId, 'highlight', {
        ref: input.ref,
        label: `input #${input.ref}`,
        duration: 1500,
      }).catch(() => {});
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
      'Extract readable text of the page. ' +
      'mode "smart_scroll" (default) detects the true scroll container (even inside Notion, Twitter, Jira modals), steps through dynamically rendered content with deduplication, and restores scroll position. ' +
      'mode "fast" reads the current viewport and all frames without scrolling. Supports offset for paging.',
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['smart_scroll', 'fast'], description: 'Reading mode, default "smart_scroll"' },
        max_screens: { type: 'integer', description: 'Max screens to scroll in smart_scroll mode (default 12, max 25)' },
        max_chars: { type: 'integer', description: 'Max characters returned, default 20000' },
        offset: { type: 'integer', description: 'Character offset to continue from, default 0' },
        tab_id: { type: 'integer' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      const mode = String(input.mode ?? 'smart_scroll');
      let full = '';
      let notes = '';

      if (mode === 'smart_scroll') {
        try {
          const r = await runInPage(ctx.tabId, 'smart_scroll_read', {
            max_screens: input.max_screens ?? 12,
          });
          full = String(r?.text ?? '');
          const flags: string[] = [];
          if (r?.screens) flags.push(`${r.screens} screens`);
          if (r?.backgroundTab) flags.push('background tab');
          if (r?.endlessFeed) flags.push('endless feed stopped');
          if (r?.renderFrozen) flags.push('content frozen');
          if (r?.stalled) flags.push('stalled at end');
          if (flags.length) notes = ` [${flags.join(', ')}]`;
        } catch {
          // Fall back to frames text if smart scroll fails
        }
      }

      if (!full) {
        const frames = await getAllFramesText(ctx.tabId);
        if (!frames.length) return { content: [{ type: 'text', text: '(page has no readable text)' }] };
        full = `Title: ${frames[0].title}\nURL: ${frames[0].url}\n\n${frames[0].text}`;
        for (const f of frames.slice(1)) {
          if (f.text.trim()) full += `\n\n----- iframe: ${f.url.slice(0, 120)} -----\n${f.text}`;
        }
      }

      const offset = Math.max(0, Number(input.offset ?? 0));
      const max = Math.min(80000, Math.max(1000, Number(input.max_chars ?? 20000)));
      const slice = full.slice(offset, offset + max);
      const tail =
        offset + max < full.length
          ? `\n…(${full.length - offset - max} more chars — call again with offset=${offset + max})`
          : '';
      return { content: [{ type: 'text', text: slice + tail + notes }] };
    },
  },
  {
    name: 'highlight_element',
    description:
      'Visually highlight an element on the live webpage with an animated glowing box and optional badge. ' +
      'Useful to draw the user\'s attention or confirm element location.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Ref of element from read_page/find' },
        label: { type: 'string', description: 'Optional badge text' },
        duration_ms: { type: 'integer', description: 'Duration in milliseconds, default 2000, capped at 10000' },
        tab_id: { type: 'integer' },
      },
      required: ['ref'],
    },
    needsTab: true,
    async run(ctx, input) {
      const ref = String(input.ref);
      const label = input.label ? String(input.label) : undefined;
      const duration = Math.min(10000, Math.max(500, Number(input.duration_ms ?? 2000)));
      const r = await runInPage(ctx.tabId, 'highlight', { ref, label, duration });
      return { content: [{ type: 'text', text: String(r?.text ?? `Highlighted element #${ref}`) }] };
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
        ctx.session.t('bg.confirmUploadDesc', [String(input.filename ?? url.slice(0, 80))]),
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
  {
    name: 'wait_for',
    description:
      'Wait until a condition holds, polling the page (across frames and shadow DOM) until satisfied or timeout. ' +
      'condition "appear": element matching query/selector exists; "disappear": element matching query/selector is gone; ' +
      '"text": page text contains a string; "text_gone": page text no longer contains a string (e.g. "Loading..." gone). ' +
      'Use this after actions that trigger async loading instead of guessing with computer "wait". Returns a fresh screenshot when satisfied.',
    schema: {
      type: 'object',
      properties: {
        condition: { type: 'string', enum: ['appear', 'disappear', 'text', 'text_gone'], description: 'What to wait for' },
        query: { type: 'string', description: 'Element text/label to match (for appear/disappear)' },
        selector: { type: 'string', description: 'CSS selector to match (for appear/disappear)' },
        text: { type: 'string', description: 'Substring to wait for in page text (for text/text_gone)' },
        timeout_ms: { type: 'integer', description: 'Max wait in ms, default 8000, capped at 30000' },
        tab_id: { type: 'integer' },
      },
      required: ['condition'],
    },
    needsTab: true,
    async run(ctx, input) {
      const condition = String(input.condition ?? '');
      if (!['appear', 'disappear', 'text', 'text_gone'].includes(condition)) throw new Error('wait_for: condition must be appear/disappear/text/text_gone');
      const query = input.query ? String(input.query) : '';
      const selector = input.selector ? String(input.selector) : '';
      const text = input.text ? String(input.text) : '';
      if ((condition === 'appear' || condition === 'disappear') && !query && !selector) throw new Error(`wait_for "${condition}" requires "query" or "selector"`);
      if ((condition === 'text' || condition === 'text_gone') && !text) throw new Error(`wait_for "${condition}" requires "text"`);

      const timeout = Math.min(30000, Math.max(500, Number(input.timeout_ms ?? 8000)));
      const start = Date.now();
      let polls = 0;
      while (Date.now() - start < timeout) {
        if (ctx.session.aborted) throw new Error('Cancelled by user.');
        let r: { matchCount?: number; textFound?: boolean } | null = null;
        try {
          r = await runInPage(ctx.tabId, 'probe', { query, text, selector });
        } catch {
          // 页面可能正处于导航跳转或脚本上下文重置中，允许单次探测失败并在下轮重试
        }
        polls++;
        if (r && conditionMet(condition, { matchCount: Number(r.matchCount ?? 0), textFound: !!r.textFound })) {
          const waited = ((Date.now() - start) / 1000).toFixed(1);
          const what = condition.startsWith('text') ? `text "${text}"` : `"${query || selector}"`;
          return withAutoShot(ctx.session, ctx.tabId, `Condition met: ${condition} ${what} after ${waited}s.`);
        }
        await sleep(400);
      }
      const what = condition.startsWith('text') ? `text "${text}"` : `"${query || selector}"`;
      return withAutoShot(
        ctx.session,
        ctx.tabId,
        `Timed out after ${(timeout / 1000).toFixed(0)}s waiting for ${condition} ${what} (${polls} polls). The condition was not met — the current state is shown; decide how to proceed.`,
      );
    },
  },
];
