// computer 工具：截图 + 可信鼠标/键盘事件（复刻 Claude in Chrome / computer-use 的动作集）
import { sleep } from '../../shared/util';
import { ensureAttached, send } from '../cdp';
import { runInPage } from '../inject';
import { confirmSensitive } from '../permissions';
import { imageToCss } from '../screenshot';
import { waitForLoad } from '../tabs';
import { shotBlocks, withAutoShot, type ToolCtx, type ToolDef } from './registry';

// ---------------- 键盘映射 ----------------
interface KeyDef {
  key: string;
  code: string;
  keyCode: number;
  text?: string;
}

const NAMED_KEYS: Record<string, KeyDef> = {
  enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  return: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
  backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
  del: { key: 'Delete', code: 'Delete', keyCode: 46 },
  space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  home: { key: 'Home', code: 'Home', keyCode: 36 },
  end: { key: 'End', code: 'End', keyCode: 35 },
  pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
  pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
};
for (let i = 1; i <= 12; i++) {
  NAMED_KEYS['f' + i] = { key: 'F' + i, code: 'F' + i, keyCode: 111 + i };
}

const MODS: Record<string, number> = {
  alt: 1, option: 1,
  control: 2, ctrl: 2,
  meta: 4, cmd: 4, command: 4, win: 4,
  shift: 8,
};

function keyDefFor(token: string): KeyDef {
  const t = token.toLowerCase();
  if (NAMED_KEYS[t]) return NAMED_KEYS[t];
  if (/^[a-z]$/.test(t)) {
    return { key: t, code: 'Key' + t.toUpperCase(), keyCode: 65 + t.charCodeAt(0) - 97, text: t };
  }
  if (/^[0-9]$/.test(t)) {
    return { key: t, code: 'Digit' + t, keyCode: 48 + Number(t), text: t };
  }
  if (t.length === 1) {
    return { key: t, code: '', keyCode: t.toUpperCase().charCodeAt(0), text: t };
  }
  throw new Error(`Unknown key "${token}". Use names like Enter, Tab, Escape, ArrowDown, or combos like "Control+a".`);
}

async function pressCombo(tabId: number, combo: string): Promise<void> {
  const tokens = combo.split('+').map((s) => s.trim()).filter(Boolean);
  if (!tokens.length) throw new Error('key: empty key combo');
  let modifiers = 0;
  const rest: string[] = [];
  for (const tk of tokens) {
    const m = MODS[tk.toLowerCase()];
    if (m != null) modifiers |= m;
    else rest.push(tk);
  }
  if (!rest.length) throw new Error(`key: "${combo}" has only modifiers — add a key, e.g. "Control+a"`);
  const def = keyDefFor(rest[rest.length - 1]);
  const base = {
    modifiers,
    key: def.key,
    code: def.code,
    windowsVirtualKeyCode: def.keyCode,
    nativeVirtualKeyCode: def.keyCode,
  };
  const withText = def.text && (modifiers === 0 || modifiers === 8);
  await send(tabId, 'Input.dispatchKeyEvent', {
    ...base,
    type: withText ? 'keyDown' : 'rawKeyDown',
    ...(withText ? { text: def.text, unmodifiedText: def.text } : {}),
  });
  await send(tabId, 'Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
}

// ---------------- 鼠标 ----------------
type MouseButton = 'left' | 'right' | 'middle';

async function mouseEvent(
  tabId: number,
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel',
  x: number,
  y: number,
  opts: { button?: MouseButton; clickCount?: number; deltaX?: number; deltaY?: number; buttons?: number } = {},
): Promise<void> {
  await send(tabId, 'Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: opts.button ?? 'none',
    clickCount: opts.clickCount ?? 0,
    deltaX: opts.deltaX,
    deltaY: opts.deltaY,
    buttons: opts.buttons,
  });
}

async function clickAt(tabId: number, x: number, y: number, button: MouseButton, clicks: number): Promise<void> {
  await mouseEvent(tabId, 'mouseMoved', x, y);
  await sleep(30);
  for (let i = 1; i <= clicks; i++) {
    await mouseEvent(tabId, 'mousePressed', x, y, { button, clickCount: i });
    await mouseEvent(tabId, 'mouseReleased', x, y, { button, clickCount: i });
    if (i < clicks) await sleep(60);
  }
}

// ---------------- 坐标解析 ----------------
async function resolvePoint(
  ctx: ToolCtx,
  input: Record<string, any>,
  action: string,
): Promise<{ x: number; y: number; note: string }> {
  if (input.ref) {
    const info = await runInPage(ctx.tabId, 'element_info', { ref: input.ref });
    let { x, y } = info;
    if (!info.inViewport) {
      const s = await runInPage(ctx.tabId, 'scroll_to', { ref: input.ref });
      x = s.x;
      y = s.y;
      await sleep(150);
    }
    return { x, y, note: ` on ${info.desc}` };
  }
  const c = input.coordinate;
  if (Array.isArray(c) && c.length === 2 && c.every((n: unknown) => Number.isFinite(Number(n)))) {
    const p = imageToCss(ctx.tabId, Number(c[0]), Number(c[1]));
    return { x: p.x, y: p.y, note: '' };
  }
  throw new Error(`computer action "${action}" requires "coordinate": [x, y] (from the latest screenshot) or "ref" (from read_page/find)`);
}

/** 动作后的稳定等待：短暂 settle + 若触发了导航则等待加载完成 */
async function settle(ctx: ToolCtx): Promise<void> {
  await sleep(300);
  try {
    const t = await chrome.tabs.get(ctx.tabId);
    if (t.status === 'loading') await waitForLoad(ctx.tabId, 10000);
  } catch {
    /* tab 可能已关闭 */
  }
}

export const computerTool: ToolDef = {
  name: 'computer',
  description:
    'Interact with a page like a human: take screenshots, click, type, press keys, scroll, drag. ' +
    'Coordinates are pixels of the MOST RECENT screenshot of that tab — always screenshot first, or pass "ref" from read_page/find instead (more reliable; auto-scrolls into view). ' +
    '"type" inserts text into the focused element (click/focus it first, or pass ref). "key" presses a key or combo like "Enter", "Control+a". ' +
    'Mutating actions automatically return a fresh screenshot.',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['screenshot', 'left_click', 'right_click', 'double_click', 'triple_click', 'hover', 'type', 'key', 'scroll', 'drag', 'wait'],
        description: 'The action to perform',
      },
      coordinate: {
        type: 'array',
        items: { type: 'integer' },
        description: '[x, y] in pixels of the latest screenshot (for click/hover/scroll position)',
      },
      ref: { type: 'string', description: 'Element ref from read_page/find — alternative to coordinate; also focuses the element for "type"' },
      text: { type: 'string', description: 'Text to type (action "type") or key combo (action "key", e.g. "Enter", "Control+a")' },
      scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction, default "down"' },
      scroll_amount: { type: 'integer', description: 'Scroll distance in px, default 600' },
      start: { type: 'array', items: { type: 'integer' }, description: 'Drag start [x, y] (action "drag")' },
      end: { type: 'array', items: { type: 'integer' }, description: 'Drag end [x, y] (action "drag")' },
      duration_ms: { type: 'integer', description: 'Wait duration in ms (action "wait"), max 5000' },
      tab_id: { type: 'integer', description: 'Target tab id (defaults to the agent\'s current tab)' },
    },
    required: ['action'],
  },
  needsTab: true,
  async run(ctx, input) {
    const action = String(input.action ?? '');
    await ensureAttached(ctx.tabId);
    ctx.session.currentTabId = ctx.tabId;

    switch (action) {
      case 'screenshot':
        return { content: await shotBlocks(ctx.session, ctx.tabId) };

      case 'left_click':
      case 'right_click':
      case 'double_click':
      case 'triple_click': {
        const p = await resolvePoint(ctx, input, action);
        const button: MouseButton = action === 'right_click' ? 'right' : 'left';
        const clicks = action === 'double_click' ? 2 : action === 'triple_click' ? 3 : 1;
        await clickAt(ctx.tabId, p.x, p.y, button, clicks);
        await settle(ctx);
        return withAutoShot(ctx.session, ctx.tabId, `Performed ${action} at css(${p.x},${p.y})${p.note}.`);
      }

      case 'hover': {
        const p = await resolvePoint(ctx, input, action);
        await mouseEvent(ctx.tabId, 'mouseMoved', p.x, p.y);
        await sleep(300);
        return withAutoShot(ctx.session, ctx.tabId, `Hovering at css(${p.x},${p.y})${p.note}.`);
      }

      case 'type': {
        const text = String(input.text ?? '');
        if (!text) throw new Error('computer type: "text" is required');
        let note = '';
        if (input.ref) {
          const f = await runInPage(ctx.tabId, 'focus', { ref: input.ref });
          if (f.isPassword) {
            await confirmSensitive(ctx.session, 'password', `智能体想向密码输入框输入内容（${text.length} 个字符）。`);
          }
          note = ` into ref ${input.ref}`;
        } else {
          const a = await runInPage(ctx.tabId, 'active_info', {});
          if (a.isPassword) {
            await confirmSensitive(ctx.session, 'password', `智能体想向密码输入框输入内容（${text.length} 个字符）。`);
          }
          if (!a.focused || !a.editable) {
            note = ' (warning: no editable element focused — click the field first or pass ref)';
          }
        }
        await send(ctx.tabId, 'Input.insertText', { text });
        await settle(ctx);
        return withAutoShot(ctx.session, ctx.tabId, `Typed ${text.length} chars${note}.`);
      }

      case 'key': {
        const combo = String(input.text ?? '');
        if (!combo) throw new Error('computer key: "text" is required (e.g. "Enter", "Control+a")');
        await pressCombo(ctx.tabId, combo);
        await settle(ctx);
        return withAutoShot(ctx.session, ctx.tabId, `Pressed ${combo}.`);
      }

      case 'scroll': {
        let x: number, y: number;
        if (input.ref || input.coordinate) {
          const p = await resolvePoint(ctx, input, action);
          x = p.x;
          y = p.y;
        } else {
          const vp = await runInPage(ctx.tabId, 'active_info', {});
          void vp;
          x = 300;
          y = 300;
        }
        const dir = String(input.scroll_direction ?? 'down');
        const amount = Math.min(20000, Math.max(40, Number(input.scroll_amount ?? 600)));
        const deltaX = dir === 'left' ? -amount : dir === 'right' ? amount : 0;
        const deltaY = dir === 'up' ? -amount : dir === 'down' ? amount : 0;
        await mouseEvent(ctx.tabId, 'mouseWheel', x, y, { deltaX, deltaY });
        await sleep(350);
        return withAutoShot(ctx.session, ctx.tabId, `Scrolled ${dir} by ${amount}px.`);
      }

      case 'drag': {
        const s = input.start;
        const e = input.end;
        if (!Array.isArray(s) || s.length !== 2 || !Array.isArray(e) || e.length !== 2) {
          throw new Error('computer drag: "start" and "end" [x, y] arrays are required');
        }
        const p1 = imageToCss(ctx.tabId, Number(s[0]), Number(s[1]));
        const p2 = imageToCss(ctx.tabId, Number(e[0]), Number(e[1]));
        await mouseEvent(ctx.tabId, 'mouseMoved', p1.x, p1.y);
        await mouseEvent(ctx.tabId, 'mousePressed', p1.x, p1.y, { button: 'left', clickCount: 1 });
        const steps = 12;
        for (let i = 1; i <= steps; i++) {
          const mx = Math.round(p1.x + ((p2.x - p1.x) * i) / steps);
          const my = Math.round(p1.y + ((p2.y - p1.y) * i) / steps);
          await mouseEvent(ctx.tabId, 'mouseMoved', mx, my, { buttons: 1 });
          await sleep(16);
        }
        await mouseEvent(ctx.tabId, 'mouseReleased', p2.x, p2.y, { button: 'left', clickCount: 1 });
        await settle(ctx);
        return withAutoShot(ctx.session, ctx.tabId, `Dragged from css(${p1.x},${p1.y}) to css(${p2.x},${p2.y}).`);
      }

      case 'wait': {
        const ms = Math.min(5000, Math.max(100, Number(input.duration_ms ?? 1000)));
        await sleep(ms);
        return withAutoShot(ctx.session, ctx.tabId, `Waited ${ms}ms.`);
      }

      default:
        throw new Error(`computer: unknown action "${action}"`);
    }
  },
};
