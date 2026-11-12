import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Session } from '../../src/background/session';
import { runTurn } from '../../src/background/agent';
import { saveConfig } from '../../src/shared/settings';
import type { AppConfig } from '../../src/shared/types';

function installMemStorage() {
  const localStore = new Map<string, unknown>();
  const syncStore = new Map<string, unknown>();
  (globalThis as any).chrome.storage.local = {
    get: async (key: string | null) => {
      if (!key) return Object.fromEntries(localStore);
      return localStore.has(key) ? { [key]: localStore.get(key) } : {};
    },
    set: async (obj: Record<string, unknown>) => {
      for (const k of Object.keys(obj)) localStore.set(k, obj[k]);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) localStore.delete(k);
    },
  };
  (globalThis as any).chrome.storage.sync = {
    get: async (key: string | null) => {
      if (!key) return Object.fromEntries(syncStore);
      return syncStore.has(key) ? { [key]: syncStore.get(key) } : {};
    },
    set: async (obj: Record<string, unknown>) => {
      for (const k of Object.keys(obj)) syncStore.set(k, obj[k]);
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) syncStore.delete(k);
    },
    getBytesInUse: async () => 0,
  };
}

function createMockConfig(port: number, maxRetries = 2): AppConfig {
  return {
    version: 2,
    providers: [{ id: 'mock-p', name: 'MockProvider', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'mock-key' }],
    models: [{ id: 'mock-model', label: 'Mock Model', vision: false, contextWindow: 4000 }],
    bindings: [{ id: 'mock-p/mock-model', modelId: 'mock-model', providerId: 'mock-p', apiModelName: 'mock-api-model', enabled: true }],
    defaultBindingId: 'mock-p/mock-model',
    safety: { allowAllSites: true, confirmNewSite: false, confirmPassword: false, confirmJavascript: false, confirmUpload: false },
    advanced: {
      maxIterations: 5,
      maxImagesKept: 2,
      maxContextTokens: 4000,
      screenshotMaxWidth: 1280,
      jpegQuality: 80,
      temperature: null,
      maxTokens: 1024,
      autoScreenshot: false,
      requestTimeoutMs: 5000,
      maxRetries,
      setOfMarks: false,
      planning: false,
      enableJavascriptTool: false,
    },
    uiLang: 'zh',
    sites: { allowed: [], blocked: [] },
  };
}

function listenOn(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve(addr.port);
    });
  });
}

test('runTurn: 模型首次返回空响应时自动重试，并在重试成功后正常结束', async () => {
  installMemStorage();
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (hits === 1) {
      // 首次：返回空 SSE 流
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 第二次重试：返回有效内容
      const chunk = { choices: [{ delta: { content: '重试成功，已达成目标。' } }] };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  const port = await listenOn(server);
  const cfg = createMockConfig(port, 2);
  await saveConfig(cfg);

  const session = new Session(1001, cfg);
  await runTurn(session, '测试空响应重试');
  server.close();

  assert.equal(hits, 2, '应请求两次（首次空响应 + 一次重试）');
  const retryInfos = session.timeline.filter(
    (t) => t.kind === 'info' && t.text.includes('返回空响应，正在重试（第 1/2 次）'),
  );
  assert.equal(retryInfos.length, 1, '应输出重试提示信息');

  const assistantMsg = session.timeline.find(
    (t) => t.kind === 'assistant' && t.text === '重试成功，已达成目标。',
  );
  assert.ok(assistantMsg, '最终应正确显示助手输出内容');

  const errorItems = session.timeline.filter((t) => t.kind === 'error');
  assert.equal(errorItems.length, 0, '重试成功后不应有错误信息');
});

test('runTurn: 模型持续返回空响应且耗尽重试次数时，输出 bg.emptyResponse 错误提示', async () => {
  installMemStorage();
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    // 持续返回空 SSE 流
    res.write('data: [DONE]\n\n');
    res.end();
  });

  const port = await listenOn(server);
  const cfg = createMockConfig(port, 2);
  await saveConfig(cfg);

  const session = new Session(1002, cfg);
  await runTurn(session, '测试重试耗尽');
  server.close();

  assert.equal(hits, 3, '应请求 3 次（1 次初始 + 2 次重试）');
  const errorItem = session.timeline.find(
    (t) => t.kind === 'error' && t.text.includes('返回空响应（无文本、无工具调用）'),
  );
  assert.ok(errorItem, '重试耗尽后应输出 bg.emptyResponse 错误');

  // 对话历史中不应存在 "(empty)" 脏消息
  const emptyInHistory = session.messages.some(
    (m) => m.role === 'assistant' && m.content.some((c: any) => c.text === '(empty)'),
  );
  assert.equal(emptyInHistory, false, '对话历史不应被空内容污染');
});

test('runTurn: 模型中途返回 500 服务端错误时自动重试并成功', async () => {
  installMemStorage();
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    if (hits === 1) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"error":{"code":500,"message":"Internal Server Error"}}\n\n');
      res.end();
    } else {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = { choices: [{ delta: { content: '服务恢复，执行完成。' } }] };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  const port = await listenOn(server);
  const cfg = createMockConfig(port, 2);
  await saveConfig(cfg);

  const session = new Session(1003, cfg);
  await runTurn(session, '测试 500 重试');
  server.close();

  assert.equal(hits, 2, '应请求两次');
  const errorRetryInfos = session.timeline.filter(
    (t) => t.kind === 'info' && t.text.includes('调用异常') && t.text.includes('重试'),
  );
  assert.equal(errorRetryInfos.length, 1, '应记录异常重试信息');

  const assistantMsg = session.timeline.find(
    (t) => t.kind === 'assistant' && t.text === '服务恢复，执行完成。',
  );
  assert.ok(assistantMsg, '重试后成功输出内容');
});
