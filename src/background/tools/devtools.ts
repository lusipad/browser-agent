// 调试类工具：javascript_tool / read_console_messages / read_network_requests
import { truncate } from '../../shared/util';
import { clearBuffers, ensureAttached, evalInPage, getConsole, getNetwork, getResponseBody } from '../cdp';
import { confirmSensitive } from '../permissions';
import type { ToolDef } from './registry';

export const devtoolsTools: ToolDef[] = [
  {
    name: 'javascript_tool',
    description:
      'Run JavaScript in the page (main world) and return its completion value, JSON-serialized. The code runs as an async function body — use `return` to produce a value; `await` is allowed. ' +
      'Use only when the dedicated tools are insufficient. Do NOT call alert/confirm/prompt (they freeze automation). Requires user approval.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code, e.g. "return document.title" or "return await fetch(\'/api\').then(r=>r.json())"' },
        tab_id: { type: 'integer' },
      },
      required: ['code'],
    },
    needsTab: true,
    async run(ctx, input) {
      if (!ctx.session.cfg.advanced.enableJavascriptTool) {
        throw new Error('javascript_tool 已被禁用（默认关闭）。如确需在页面执行任意 JS，请到设置页「高级」开启后重试；否则改用专用工具（read_page/find/extract_data/form_input 等）。');
      }
      const code = String(input.code ?? '');
      if (!code.trim()) throw new Error('javascript_tool: "code" is required');
      await confirmSensitive(
        ctx.session,
        'javascript',
        '代码预览：\n' + truncate(code, 600),
      );
      const value = await evalInPage(ctx.tabId, `(async () => {\n${code}\n})()`);
      let rendered: string;
      try {
        rendered = value === undefined ? 'undefined（提示：需要 return 才有返回值）' : JSON.stringify(value);
      } catch {
        rendered = String(value);
      }
      return { content: [{ type: 'text', text: 'Result: ' + truncate(rendered ?? 'null', 10000) }] };
    },
  },
  {
    name: 'read_console_messages',
    description:
      'Read console messages (log/warn/error + uncaught exceptions) from a tab. Messages are collected only while the agent is attached to the tab — interact with or reload the page first if the buffer is empty. Use "pattern" (regex) to filter.',
    schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex to filter messages, e.g. "error|failed" or "\\\\[MyApp\\\\]"' },
        limit: { type: 'integer', description: 'Max messages returned, default 80' },
        clear: { type: 'boolean', description: 'Clear the buffer after reading' },
        tab_id: { type: 'integer' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      await ensureAttached(ctx.tabId);
      const entries = getConsole(ctx.tabId, input.pattern ? String(input.pattern) : undefined, Number(input.limit ?? 80));
      if (input.clear) clearBuffers(ctx.tabId);
      if (!entries.length) {
        return {
          content: [
            {
              type: 'text',
              text: 'No console messages captured yet. The buffer fills only while the agent is attached — reload the page (navigate action "reload") to capture logs from page load.',
            },
          ],
        };
      }
      const lines = entries.map((e) => `[${e.level}] ${e.text}`);
      return { content: [{ type: 'text', text: truncate(lines.join('\n'), 20000) }] };
    },
  },
  {
    name: 'read_network_requests',
    description:
      'List network requests from a tab (method, status, type, size, url). Collected only while the agent is attached — reload first to capture page-load requests. Pass body_request_id to fetch a specific response body.',
    schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Substring of url, or a resource type like "xhr"/"fetch"/"document"' },
        limit: { type: 'integer', description: 'Max requests returned, default 60' },
        body_request_id: { type: 'string', description: 'Request id (from a previous listing) whose response body to return' },
        tab_id: { type: 'integer' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      await ensureAttached(ctx.tabId);
      if (input.body_request_id) {
        const body = await getResponseBody(ctx.tabId, String(input.body_request_id));
        return { content: [{ type: 'text', text: body || '(empty body)' }] };
      }
      const entries = getNetwork(ctx.tabId, input.filter ? String(input.filter) : undefined, Number(input.limit ?? 60));
      if (!entries.length) {
        return {
          content: [
            {
              type: 'text',
              text: 'No network requests captured yet. The buffer fills only while the agent is attached — reload the page to capture its requests.',
            },
          ],
        };
      }
      const lines = entries.map((e) => {
        const size = e.encodedBytes != null ? ` ${Math.round(e.encodedBytes / 102.4) / 10}KB` : '';
        const st = e.error ? `FAILED(${e.error})` : (e.status ?? (e.finished ? 'done' : 'pending'));
        return `[${e.requestId}] ${e.method} ${st} ${e.resourceType}${size} ${e.url.slice(0, 150)}`;
      });
      return { content: [{ type: 'text', text: truncate(lines.join('\n'), 20000) }] };
    },
  },
];
