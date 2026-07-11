// 标签页 / 导航 / 窗口 工具
import { ensureSiteAllowed } from '../permissions';
import { addToAgentGroup, getTab, listAllTabs, waitForLoad } from '../tabs';
import { shotBlocks, withAutoShot, type ToolDef } from './registry';

function normalizeUrl(raw: string): string {
  let url = String(raw).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = 'https://' + url;
  return url;
}

export const browserTools: ToolDef[] = [
  {
    name: 'tabs_context',
    description:
      'List all open browser tabs with their id, url, title, active state and load status. Call this FIRST to ground yourself. Never guess or reuse tab ids from previous conversations.',
    schema: { type: 'object', properties: {} },
    needsTab: false,
    async run(ctx) {
      const tabs = await listAllTabs();
      if (!tabs.length) return { content: [{ type: 'text', text: 'No open tabs.' }] };
      const lines = tabs.map((t) => {
        const marks: string[] = [];
        if (t.active) marks.push('active');
        if (t.id === ctx.session.currentTabId) marks.push('agent-current');
        if (t.status === 'loading') marks.push('loading');
        if (t.windowId === ctx.session.windowId) marks.push('this-window');
        return `[id=${t.id}]${marks.length ? ' (' + marks.join(', ') + ')' : ''} "${t.title.slice(0, 80)}" — ${t.url.slice(0, 120)}`;
      });
      return {
        content: [
          {
            type: 'text',
            text: `Open tabs (${tabs.length}). The user's side panel lives in window ${ctx.session.windowId}:\n${lines.join('\n')}`,
          },
        ],
      };
    },
  },
  {
    name: 'tabs_create',
    description:
      'Create a new browser tab (grouped under the "Agent" tab group) and make it the agent\'s current tab. Prefer this over taking over the user\'s existing tabs. Returns the new tab id.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open. Omit for a blank tab.' },
      },
    },
    needsTab: false,
    async run(ctx, input) {
      const url = input.url ? normalizeUrl(input.url) : 'about:blank';
      if (url !== 'about:blank') {
        await ensureSiteAllowed(ctx.session, url, `打开新标签页访问 ${url.slice(0, 120)}`);
      }
      const tab = await chrome.tabs.create({ url, windowId: ctx.session.windowId, active: true });
      if (tab.id == null) throw new Error('Failed to create tab');
      await addToAgentGroup(tab.windowId, tab.id);
      ctx.session.currentTabId = tab.id;
      if (url !== 'about:blank') await waitForLoad(tab.id);
      const fresh = await getTab(tab.id);
      return {
        content: [
          {
            type: 'text',
            text: `Created tab id=${tab.id}: "${fresh.title ?? ''}" — ${fresh.url ?? url}. It is now the agent's current tab.`,
          },
        ],
      };
    },
  },
  {
    name: 'tabs_close',
    description: 'Close a browser tab by id. Only close tabs you created unless the user asked otherwise.',
    schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer', description: 'Tab id to close' } },
      required: ['tab_id'],
    },
    needsTab: false,
    async run(ctx, input) {
      const id = Number(input.tab_id);
      await getTab(id);
      await chrome.tabs.remove(id);
      if (ctx.session.currentTabId === id) ctx.session.currentTabId = null;
      return { content: [{ type: 'text', text: `Closed tab ${id}.` }] };
    },
  },
  {
    name: 'navigate',
    description:
      'Navigate a tab: go to a URL (default), or "back" / "forward" / "reload". Waits for the page to load and returns the final url/title plus a fresh screenshot.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL (required unless action is back/forward/reload)' },
        action: { type: 'string', enum: ['url', 'back', 'forward', 'reload'], description: 'Navigation action, default "url"' },
        tab_id: { type: 'integer', description: 'Target tab id (defaults to the agent\'s current tab)' },
      },
    },
    needsTab: true,
    async run(ctx, input) {
      const action = String(input.action ?? 'url');
      if (action === 'url') {
        if (!input.url) throw new Error('navigate: "url" is required (or set action to back/forward/reload)');
        const url = normalizeUrl(String(input.url));
        await ensureSiteAllowed(ctx.session, url, `跳转到 ${url.slice(0, 120)}`);
        await chrome.tabs.update(ctx.tabId, { url });
      } else if (action === 'back') {
        await chrome.tabs.goBack(ctx.tabId).catch(() => {
          throw new Error('Cannot go back (no history)');
        });
      } else if (action === 'forward') {
        await chrome.tabs.goForward(ctx.tabId).catch(() => {
          throw new Error('Cannot go forward (no history)');
        });
      } else if (action === 'reload') {
        await chrome.tabs.reload(ctx.tabId);
      } else {
        throw new Error(`navigate: unknown action "${action}"`);
      }
      ctx.session.currentTabId = ctx.tabId;
      await waitForLoad(ctx.tabId);
      const tab = await getTab(ctx.tabId);
      return withAutoShot(ctx.session, ctx.tabId, `Now at: "${tab.title ?? ''}" — ${tab.url ?? ''} (tab ${ctx.tabId})`);
    },
  },
  {
    name: 'resize_window',
    description: 'Resize the browser window that contains the side panel (useful for testing responsive layouts).',
    schema: {
      type: 'object',
      properties: {
        width: { type: 'integer', description: 'Window width in px' },
        height: { type: 'integer', description: 'Window height in px' },
      },
      required: ['width', 'height'],
    },
    needsTab: false,
    async run(ctx, input) {
      const width = Math.min(3840, Math.max(320, Number(input.width)));
      const height = Math.min(2160, Math.max(240, Number(input.height)));
      await chrome.windows.update(ctx.session.windowId, { width, height, state: 'normal' });
      return { content: [{ type: 'text', text: `Window resized to ${width}x${height}.` }] };
    },
  },
  {
    name: 'screenshot',
    description:
      'Take a screenshot of a tab without performing any action. Equivalent to computer action "screenshot". Use it to see the current state of the page.',
    schema: {
      type: 'object',
      properties: { tab_id: { type: 'integer', description: 'Target tab id (defaults to the agent\'s current tab)' } },
    },
    needsTab: true,
    async run(ctx) {
      return { content: await shotBlocks(ctx.session, ctx.tabId) };
    },
  },
];
