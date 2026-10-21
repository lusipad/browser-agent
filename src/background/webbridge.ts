// ============================================================
// WebBridge: 本地桌面双向反向 WebSocket 网桥客户端
// 支持外部 CLI、IDE、MCP 工具及桌面伴侣直接驱动浏览器智能体
// ============================================================

import type { AppConfig } from '../shared/types';
import { textOfBlocks, uid } from '../shared/util';
import type { Session } from './session';
import { executeToolUse } from './tools/registry';

export interface WebBridgeStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'conflict';
  url: string;
  clientId: string;
  lastError?: string;
}

export interface WebBridgeMessage {
  id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
}

export class WebBridgeClient {
  private ws: WebSocket | null = null;
  private cfg: AppConfig | null = null;
  private status: 'connected' | 'disconnected' | 'connecting' | 'conflict' = 'disconnected';
  private reconnectTimer: any = null;
  private reconnectDelay = 1000;
  private readonly clientId: string;
  private getSession: (windowId?: number) => Promise<Session>;
  private lastError?: string;

  constructor(getSession: (windowId?: number) => Promise<Session>) {
    this.clientId = uid('wb');
    this.getSession = getSession;
  }

  getStatus(): WebBridgeStatus {
    return {
      connected: this.status === 'connected',
      status: this.status,
      url: this.cfg?.webbridge?.url || 'ws://127.0.0.1:10086/ws',
      clientId: this.clientId,
      lastError: this.lastError,
    };
  }

  updateConfig(cfg: AppConfig): void {
    const prevUrl = this.cfg?.webbridge?.url;
    const prevEnabled = this.cfg?.webbridge?.enabled;
    this.cfg = cfg;

    const nextEnabled = !!cfg.webbridge?.enabled;
    const nextUrl = cfg.webbridge?.url;

    if (!nextEnabled) {
      this.disconnect();
    } else if (!prevEnabled || prevUrl !== nextUrl || this.status === 'disconnected') {
      this.disconnect();
      this.connect();
    }
  }

  connect(): void {
    if (!this.cfg?.webbridge?.enabled) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    const baseUrl = this.cfg.webbridge.url || 'ws://127.0.0.1:10086/ws';
    const sep = baseUrl.includes('?') ? '&' : '?';
    const targetUrl = `${baseUrl}${sep}client=${encodeURIComponent(this.clientId)}${
      this.cfg.webbridge.authToken ? `&token=${encodeURIComponent(this.cfg.webbridge.authToken)}` : ''
    }`;

    this.status = 'connecting';

    try {
      this.ws = new WebSocket(targetUrl);
    } catch (err: any) {
      this.handleClose(1006, err?.message || 'WebSocket creation failed');
      return;
    }

    this.ws.onopen = () => {
      this.status = 'connected';
      this.reconnectDelay = 1000;
      this.lastError = undefined;
      this.send({
        method: 'hello',
        params: {
          client: this.clientId,
          version: '0.7.2',
          role: 'browser_extension',
          timestamp: Date.now(),
        },
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WebBridgeMessage;
        await this.handleIncoming(msg);
      } catch (e: any) {
        this.send({ error: `Invalid JSON: ${e?.message || String(e)}` });
      }
    };

    this.ws.onerror = (e: any) => {
      this.lastError = e?.message || 'WebSocket error';
    };

    this.ws.onclose = (event) => {
      this.handleClose(event.code, event.reason);
    };
  }

  disconnect(): void {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close(1000, 'Normal disconnect');
      } catch {}
      this.ws = null;
    }
    this.status = 'disconnected';
  }

  private handleClose(code: number, reason?: string): void {
    this.ws = null;
    if (code === 4409) {
      // 冲突：另一个浏览器实例正在驱动守护进程
      this.status = 'conflict';
      this.lastError = 'WebBridge conflict (code 4409): daemon is driven by another browser instance.';
      // 冲突时暂停快速重连，设置 60 秒长等待
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.cfg?.webbridge?.enabled) {
          this.connect();
        }
      }, 60000);
      if (typeof this.reconnectTimer?.unref === 'function') {
        this.reconnectTimer.unref();
      }
      return;
    }

    this.status = 'disconnected';
    if (this.cfg?.webbridge?.enabled) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(30000, this.reconnectDelay * 1.5);
        this.connect();
      }, this.reconnectDelay);
      if (typeof this.reconnectTimer?.unref === 'function') {
        this.reconnectTimer.unref();
      }
    }
  }

  private send(msg: WebBridgeMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleIncoming(msg: WebBridgeMessage): Promise<void> {
    if (!msg.method) return;
    const reqId = msg.id || uid('wb_res');

    try {
      switch (msg.method) {
        case 'ping': {
          this.send({
            id: reqId,
            result: {
              pong: true,
              client: this.clientId,
              timestamp: Date.now(),
              version: '0.7.2',
            },
          });
          break;
        }

        case 'get_status': {
          this.send({
            id: reqId,
            result: this.getStatus(),
          });
          break;
        }

        case 'list_tabs': {
          const tabs = await chrome.tabs.query({});
          this.send({
            id: reqId,
            result: tabs.map((t) => ({
              id: t.id,
              url: t.url,
              title: t.title,
              active: t.active,
              windowId: t.windowId,
            })),
          });
          break;
        }

        case 'execute_tool': {
          const { name, input, windowId } = msg.params || {};
          if (!name) throw new Error('Missing tool name');
          const session = await this.getSession(windowId);
          const toolId = uid('t_wb');
          const tu = {
            type: 'tool_use' as const,
            id: toolId,
            name,
            input: input || {},
          };
          const out = await executeToolUse(session, tu);
          this.send({
            id: reqId,
            result: {
              name,
              output: textOfBlocks(out.content),
              isError: out.isError,
            },
          });
          break;
        }

        case 'screenshot': {
          const { windowId } = msg.params || {};
          const session = await this.getSession(windowId);
          const winId = session.windowId;
          const dataUrl = await chrome.tabs.captureVisibleTab(winId, { format: 'jpeg', quality: 80 });
          this.send({
            id: reqId,
            result: {
              dataUrl,
            },
          });
          break;
        }

        default: {
          this.send({
            id: reqId,
            error: `Unsupported method: ${msg.method}`,
          });
          break;
        }
      }
    } catch (e: any) {
      this.send({
        id: reqId,
        error: e?.message || String(e),
      });
    }
  }
}
