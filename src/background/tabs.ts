import { sleep } from '../shared/util';

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
  status: string;
}

export function tabInfo(t: chrome.tabs.Tab): TabInfo {
  return {
    id: t.id ?? -1,
    url: t.url ?? '',
    title: t.title ?? '',
    active: !!t.active,
    windowId: t.windowId,
    status: t.status ?? 'unknown',
  };
}

export async function listAllTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((t) => t.id != null).map(tabInfo);
}

export async function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    throw new Error(`Tab ${tabId} does not exist (it may have been closed). Call tabs_context for fresh tab ids.`);
  }
}

export async function activeTabIn(windowId: number | null): Promise<chrome.tabs.Tab | null> {
  const q: chrome.tabs.QueryInfo =
    windowId != null ? { active: true, windowId } : { active: true, lastFocusedWindow: true };
  const tabs = await chrome.tabs.query(q);
  return tabs[0] ?? null;
}

/** 等待页面加载完成（含 400ms 的“导航是否发生”宽限期） */
export async function waitForLoad(tabId: number, timeoutMs = 12000): Promise<void> {
  await sleep(400);
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  if (tab.status === 'complete') return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done(): void {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(id: number, info: chrome.tabs.TabChangeInfo): void {
      if (id === tabId && info.status === 'complete') done();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
  await sleep(250); // 渲染余量
}

/** 把智能体创建的标签页归入 “Agent” 标签组（复刻 Claude in Chrome 行为） */
export async function addToAgentGroup(windowId: number, tabId: number): Promise<void> {
  try {
    const groups = await chrome.tabGroups.query({ windowId, title: 'Agent' });
    if (groups.length) {
      await chrome.tabs.group({ tabIds: tabId, groupId: groups[0].id });
    } else {
      const gid = await chrome.tabs.group({ tabIds: tabId, createProperties: { windowId } });
      await chrome.tabGroups.update(gid, { title: 'Agent', color: 'blue' });
    }
  } catch {
    /* 标签组不可用（如某些窗口类型）时静默忽略 */
  }
}
