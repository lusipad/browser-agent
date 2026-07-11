// 与后台 Service Worker 的长连接封装（自动重连）
import type { BgToPanel, PanelToBg } from '../shared/types';

type Listener = (msg: BgToPanel) => void;

export class BgPort {
  private port: chrome.runtime.Port | null = null;
  private listeners = new Set<Listener>();
  private windowId: number | null = null;

  async connect(): Promise<void> {
    const win = await chrome.windows.getCurrent();
    this.windowId = win.id ?? chrome.windows.WINDOW_ID_CURRENT;
    this.open();
  }

  private open(): void {
    this.port = chrome.runtime.connect({ name: 'panel' });
    this.port.onMessage.addListener((msg: BgToPanel) => {
      for (const l of this.listeners) l(msg);
    });
    this.port.onDisconnect.addListener(() => {
      this.port = null;
      // SW 空闲回收后重连，并请求快照恢复
      setTimeout(() => {
        this.open();
        this.hello();
      }, 400);
    });
    this.hello();
  }

  private hello(): void {
    if (this.windowId != null) this.post({ type: 'hello', windowId: this.windowId });
  }

  post(msg: PanelToBg): void {
    try {
      this.port?.postMessage(msg);
    } catch {
      /* 断开中，重连后由 hello 恢复 */
    }
  }

  onMessage(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
