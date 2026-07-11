// 工具注册表：定义 + 分发 + 站点授权门控 + 动作后自动截图
import type { ToolSpec } from '../../providers';
import type { ImageBlock, TextBlock, ToolOutput, ToolUseBlock } from '../../shared/types';
import { errText, truncate } from '../../shared/util';
import { runInPage } from '../inject';
import type { RawMark } from '../marks';
import { ensureSiteAllowed } from '../permissions';
import { captureScreenshot } from '../screenshot';
import type { Session } from '../session';
import { activeTabIn, getTab } from '../tabs';

export interface ToolCtx {
  session: Session;
  /** needsTab 的工具在执行前已完成解析与站点授权 */
  tabId: number;
}

export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  needsTab: boolean;
  run(ctx: ToolCtx, input: Record<string, any>): Promise<ToolOutput>;
}

const defs: ToolDef[] = [];

export function registerTools(list: ToolDef[]): void {
  defs.push(...list);
}

export function toolSpecs(): ToolSpec[] {
  return defs.map((d) => ({ name: d.name, description: d.description, schema: d.schema }));
}

export async function executeToolUse(session: Session, tu: ToolUseBlock): Promise<ToolOutput> {
  const def = defs.find((d) => d.name === tu.name);
  if (!def) {
    return { content: [{ type: 'text', text: `Unknown tool: ${tu.name}` }], isError: true };
  }
  const input = (tu.input && typeof tu.input === 'object' ? tu.input : {}) as Record<string, any>;
  try {
    let tabId = -1;
    if (def.needsTab) {
      tabId = await resolveTab(session, input.tab_id);
      const tab = await getTab(tabId);
      await ensureSiteAllowed(session, tab.url || tab.pendingUrl, `在当前页面执行 ${tu.name}`);
    }
    return await def.run({ session, tabId }, input);
  } catch (e) {
    return { content: [{ type: 'text', text: errText(e) }], isError: true };
  }
}

async function resolveTab(session: Session, tabIdParam: unknown): Promise<number> {
  if (typeof tabIdParam === 'number' && Number.isFinite(tabIdParam) && tabIdParam >= 0) {
    return tabIdParam;
  }
  if (session.currentTabId != null) {
    try {
      await chrome.tabs.get(session.currentTabId);
      return session.currentTabId;
    } catch {
      session.currentTabId = null;
    }
  }
  const t = await activeTabIn(session.windowId);
  if (t?.id != null) return t.id;
  throw new Error('No target tab available. Call tabs_context and pass an explicit tab_id, or create one with tabs_create.');
}

/** 截图 → [meta 文本, 图片]；无视觉模型只返回 meta 文本；同时记录 GIF 帧 */
export async function shotBlocks(
  session: Session,
  tabId: number,
  label?: string,
): Promise<Array<TextBlock | ImageBlock>> {
  const adv = session.cfg.advanced;
  const vision = session.modelVision();

  // set-of-marks：先收集可交互元素，作为编号框叠加到截图上（仅视觉模型）
  let rawMarks: RawMark[] | undefined;
  let elements: any[] = [];
  if (vision && adv.setOfMarks) {
    try {
      const collected = await runInPage(tabId, 'collect');
      elements = collected?.elements ?? [];
      rawMarks = elements
        .filter((e: any) => e.inView)
        .map((e: any) => ({ ref: e.ref, x: e.x, y: e.y, w: e.w, h: e.h, inView: true, label: e.label }));
    } catch {
      /* chrome:// 等不可注入页面：退化为无标注截图 */
    }
  }

  const shot = await captureScreenshot(tabId, {
    maxWidth: adv.screenshotMaxWidth,
    quality: adv.jpegQuality,
    marks: rawMarks,
  });
  session.recordFrame({ data: shot.data, mediaType: shot.mediaType });

  let tab: chrome.tabs.Tab | undefined;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    /* ignore */
  }
  const scrollMax = Math.max(0, shot.docH - shot.cssH);
  let meta =
    `Screenshot of tab ${tabId}${label ? ` (${label})` : ''}: ${shot.w}x${shot.h} px.\n` +
    `Page: "${tab?.title ?? ''}" — ${tab?.url ?? ''}\n` +
    `scrollY ${shot.scrollY}/${scrollMax}${shot.scrollY < scrollMax ? ' (more content below)' : ''}`;

  if (!vision) {
    return [
      {
        type: 'text',
        text: meta + '\n(screenshot omitted: the current model has no vision — use read_page / find / get_page_text instead)',
      },
    ];
  }

  if (shot.marks.length) {
    const byRef = new Map(elements.map((e: any) => [e.ref, e]));
    const legend = shot.marks
      .map((m) => {
        const e = byRef.get(m.ref);
        return `[${m.ref}] ${e?.label ?? ''}`.trim();
      })
      .join('\n');
    meta +=
      `\n\nThe screenshot is annotated with ${shot.marks.length} numbered boxes over interactive elements. ` +
      `To act on one, pass its number as "ref" (e.g. computer left_click ref:"${shot.marks[0].ref}", or form_input ref:"${shot.marks[0].ref}"). ` +
      `Elements not boxed (offscreen or unmarked) are still available via read_page/find.\n== Marked elements ==\n${legend}`;
  }
  return [
    { type: 'text', text: meta },
    { type: 'image', mediaType: shot.mediaType, data: shot.data },
  ];
}

/** 会改变页面的动作统一出口：结果文本 + （可选）自动附带新截图 */
export async function withAutoShot(session: Session, tabId: number, text: string): Promise<ToolOutput> {
  const blocks: Array<TextBlock | ImageBlock> = [{ type: 'text', text }];
  if (session.cfg.advanced.autoScreenshot) {
    try {
      blocks.push(...(await shotBlocks(session, tabId, 'after action')));
    } catch (e) {
      blocks.push({ type: 'text', text: `(auto-screenshot failed: ${truncate(errText(e), 300)})` });
    }
  }
  return { content: blocks };
}
