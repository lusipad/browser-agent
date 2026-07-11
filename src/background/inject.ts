// chrome.scripting 注入封装
import { errText } from '../shared/util';
import { pageAgent, pageTextFrame } from './reader';

export async function runInPage(tabId: number, cmd: string, payload?: unknown): Promise<any> {
  let results: Array<{ result?: any }>;
  try {
    results = (await chrome.scripting.executeScript({
      target: { tabId },
      func: pageAgent,
      args: [cmd, payload ?? null],
    } as any)) as Array<{ result?: any }>;
  } catch (e) {
    throw new Error(
      `Cannot run scripts in this tab: ${errText(e)} (browser-internal pages like chrome:// and the Web Store cannot be automated — navigate to a normal website first)`,
    );
  }
  const r = results?.[0]?.result;
  if (r && typeof r === 'object' && '__error' in r) throw new Error(String(r.__error));
  return r;
}

export async function getAllFramesText(
  tabId: number,
): Promise<Array<{ url: string; title: string; text: string }>> {
  let results: Array<{ result?: any }>;
  try {
    results = (await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: pageTextFrame,
      args: [],
    } as any)) as Array<{ result?: any }>;
  } catch (e) {
    throw new Error(`Cannot read this tab: ${errText(e)}`);
  }
  return results.map((x) => x?.result).filter((x): x is { url: string; title: string; text: string } => !!x);
}
