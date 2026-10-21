#!/usr/bin/env node
// ============================================================
// WebBridge Daemon: 本地反向 WebSocket 守护进程与 MCP 桥接服务
// 供本地 CLI、IDE 扩展 (Cursor / Claude Desktop / Antigravity) 驱动浏览器
// ============================================================

import http from 'node:http';
import crypto from 'node:crypto';
import readline from 'node:readline';

const PORT = 10086;
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebBridgeDaemon {
  constructor(port = PORT) {
    this.port = port;
    this.server = null;
    this.activeSocket = null;
    this.activeClientId = null;
    this.pendingRequests = new Map();
    this.reqSeq = 1;
  }

  start() {
    this.server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            connected: !!this.activeSocket,
            client: this.activeClientId,
            timestamp: Date.now(),
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end('WebBridge Daemon');
    });

    this.server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (!url.pathname.startsWith('/ws')) {
        socket.destroy();
        return;
      }

      const client = url.searchParams.get('client') || 'anonymous';
      const key = req.headers['sec-websocket-key'];
      if (!key) {
        socket.destroy();
        return;
      }

      // 4409 实例冲突保护逻辑（单活跃实例驱动）
      if (this.activeSocket && this.activeSocket !== socket) {
        // 如果存在另一个活跃客户端且不是同名重连，拒绝并回复 4409
        if (this.activeClientId && this.activeClientId !== client) {
          const acceptKey = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
          socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
              'Upgrade: websocket\r\n' +
              'Connection: Upgrade\r\n' +
              `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
          );
          // 发送 4409 close frame
          this.sendClose(socket, 4409, 'Another browser instance is already driving daemon');
          setTimeout(() => socket.destroy(), 100);
          return;
        }
      }

      const acceptKey = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
      );

      this.activeSocket = socket;
      this.activeClientId = client;
      this.log(`✓ Browser extension connected (client: ${client})`);

      socket.on('data', (buf) => this.handleSocketData(socket, buf));
      socket.on('close', () => {
        if (this.activeSocket === socket) {
          this.log(`Browser extension disconnected (client: ${client})`);
          this.activeSocket = null;
          this.activeClientId = null;
        }
      });
      socket.on('error', (err) => {
        this.log(`Socket error: ${err.message}`);
      });
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        this.log(`🚀 WebBridge Daemon listening on ws://127.0.0.1:${this.port}/ws`);
        resolve(this);
      });
      this.server.on('error', reject);
    });
  }

  stop() {
    if (this.activeSocket) {
      try {
        this.sendClose(this.activeSocket, 1000, 'Daemon stopping');
        this.activeSocket.destroy();
      } catch {}
      this.activeSocket = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  log(...args) {
    if (process.argv.includes('--stdio')) {
      // stdio 模式不往 stdout 打乱 JSON-RPC
      console.error('[WebBridge]', ...args);
    } else {
      console.log('[WebBridge]', ...args);
    }
  }

  sendFrame(socket, payload) {
    if (!socket || socket.destroyed) return;
    const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const data = Buffer.from(jsonStr, 'utf8');
    const len = data.length;

    let header;
    if (len < 126) {
      header = Buffer.from([0x81, len]);
    } else if (len <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    socket.write(Buffer.concat([header, data]));
  }

  sendClose(socket, code = 1000, reason = '') {
    if (!socket || socket.destroyed) return;
    const rBuf = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + rBuf.length);
    payload.writeUInt16BE(code, 0);
    rBuf.copy(payload, 2);

    const header = Buffer.from([0x88, payload.length]);
    socket.write(Buffer.concat([header, payload]));
  }

  handleSocketData(socket, buf) {
    try {
      if (buf.length < 2) return;
      const opcode = buf[0] & 0x0f;
      const isMasked = (buf[1] & 0x80) !== 0;
      let payloadLen = buf[1] & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        payloadLen = buf.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        payloadLen = Number(buf.readBigUInt64BE(offset));
        offset += 8;
      }

      let mask = null;
      if (isMasked) {
        mask = buf.slice(offset, offset + 4);
        offset += 4;
      }

      const payload = buf.slice(offset, offset + payloadLen);
      if (isMasked && mask) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }

      if (opcode === 0x08) {
        // Close frame
        socket.end();
        return;
      }
      if (opcode === 0x09) {
        // Ping
        const pongHeader = Buffer.from([0x8a, 0]);
        socket.write(pongHeader);
        return;
      }

      if (opcode === 0x01) {
        // Text message
        const text = payload.toString('utf8');
        const msg = JSON.parse(text);
        this.onClientMessage(msg);
      }
    } catch (e) {
      this.log(`Error parsing WS frame: ${e.message}`);
    }
  }

  onClientMessage(msg) {
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const { resolve, reject } = this.pendingRequests.get(msg.id);
      this.pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
      return;
    }
  }

  async call(method, params = {}, timeoutMs = 30000) {
    if (!this.activeSocket) {
      throw new Error('No browser extension connected to WebBridge');
    }
    const id = `req_${this.reqSeq++}_${Date.now()}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`WebBridge RPC timeout (${timeoutMs}ms) for ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.sendFrame(this.activeSocket, { id, method, params });
    });
  }
}

// ---------------- MCP (Model Context Protocol) 兼容层 ----------------
function setupMcpProtocol(daemon) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  function sendMcp(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const { id, method, params } = req;

      if (method === 'initialize') {
        sendMcp({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'browser-agent-webbridge', version: '0.7.2' },
          },
        });
        return;
      }

      if (method === 'notifications/initialized') {
        return;
      }

      if (method === 'tools/list') {
        sendMcp({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'browser_list_tabs',
                description: 'List all open browser tabs with IDs, titles, and URLs.',
                inputSchema: { type: 'object', properties: {} },
              },
              {
                name: 'browser_execute_tool',
                description: 'Execute native browser agent tool (click, input, navigate, etc.).',
                inputSchema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', description: 'Tool name (e.g. click, form_input, read_page)' },
                    input: { type: 'object', description: 'Arguments for the tool' },
                  },
                },
              },
              {
                name: 'browser_screenshot',
                description: 'Capture screenshot of the visible tab as a JPEG data URL.',
                inputSchema: { type: 'object', properties: {} },
              },
              {
                name: 'browser_get_status',
                description: 'Get WebBridge daemon connection status.',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        });
        return;
      }

      if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName === 'browser_get_status') {
          sendMcp({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ connected: !!daemon.activeSocket, client: daemon.activeClientId }) }],
            },
          });
          return;
        }

        if (toolName === 'browser_list_tabs') {
          const tabs = await daemon.call('list_tabs');
          sendMcp({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(tabs, null, 2) }],
            },
          });
          return;
        }

        if (toolName === 'browser_screenshot') {
          const res = await daemon.call('screenshot');
          sendMcp({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: res.dataUrl }],
            },
          });
          return;
        }

        if (toolName === 'browser_execute_tool') {
          const res = await daemon.call('execute_tool', {
            name: toolArgs.name,
            input: toolArgs.input,
          });
          sendMcp({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: res.output || 'OK' }],
              isError: res.isError,
            },
          });
          return;
        }

        sendMcp({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        });
        return;
      }

      // Default ping or unknown
      if (id != null) {
        sendMcp({
          jsonrpc: '2.0',
          id,
          result: {},
        });
      }
    } catch (e) {
      sendMcp({
        jsonrpc: '2.0',
        error: { code: -32603, message: e.message },
      });
    }
  });
}

// ---------------- 命令行交互 CLI ----------------
function setupInteractiveCli(daemon) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nCommands:');
  console.log('  tabs         - List all open tabs');
  console.log('  status       - Show connection status');
  console.log('  shot         - Capture visible tab screenshot');
  console.log('  tool <name>  - Execute a tool (e.g. tool get_page_text)');
  console.log('  quit / exit  - Stop daemon\n');

  rl.setPrompt('webbridge> ');
  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    const [cmd, ...args] = trimmed.split(/\s+/);

    try {
      if (cmd === 'quit' || cmd === 'exit') {
        daemon.stop();
        process.exit(0);
      } else if (cmd === 'status') {
        console.log(`Connected: ${!!daemon.activeSocket}`);
        console.log(`Client: ${daemon.activeClientId || 'None'}`);
      } else if (cmd === 'tabs') {
        const tabs = await daemon.call('list_tabs');
        console.log(JSON.stringify(tabs, null, 2));
      } else if (cmd === 'shot') {
        const res = await daemon.call('screenshot');
        console.log(`Screenshot captured: ${res.dataUrl?.slice(0, 60)}...`);
      } else if (cmd === 'tool') {
        const name = args[0] || 'get_page_text';
        let input = {};
        if (args[1]) {
          try { input = JSON.parse(args.slice(1).join(' ')); } catch {}
        }
        const res = await daemon.call('execute_tool', { name, input });
        console.log('Result:', res);
      } else if (trimmed) {
        console.log(`Unknown command: ${cmd}`);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
    rl.prompt();
  });
}

// ---------------- 主入口 ----------------
const isMain = process.argv[1] && (process.argv[1].endsWith('webbridge-daemon.mjs') || process.argv[1].includes('webbridge'));

if (isMain) {
  const daemon = new WebBridgeDaemon();
  await daemon.start();

  if (process.argv.includes('--stdio')) {
    setupMcpProtocol(daemon);
  } else {
    setupInteractiveCli(daemon);
  }
}

export { WebBridgeDaemon };
