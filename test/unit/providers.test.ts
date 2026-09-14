import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  classifyProviderError,
  fetchWithRetry,
  HttpError,
  isRetryableStatus,
  mergeConsecutive,
  readErrorBody,
} from '../../src/providers/types';
import { openaiStream } from '../../src/providers/openai';
import { unavailableModelNames } from '../../src/options/panels/ProvidersPanel';
import { discoverEndpointModels } from '../../src/shared/registry';
import { endpointUrls } from '../../src/shared/endpoints';
import type { ChatMessage } from '../../src/shared/types';

const PROV = { id: 'p', name: 'Mock', baseUrl: 'http://x/v1', apiKey: 'k' };

test('unavailableModelNames: 只报告该服务商中接口未返回的模型', () => {
  const models = [
    { id: 'b-missing', modelId: 'missing', providerId: 'p', apiModelName: 'missing' },
    { id: 'b-ready', modelId: 'ready', providerId: 'p', apiModelName: 'ready' },
    { id: 'b-other-missing', modelId: 'missing', providerId: 'other', apiModelName: 'missing' },
  ];

  assert.deepEqual(unavailableModelNames(models, 'p', ['ready']), ['missing']);
  assert.deepEqual(unavailableModelNames(models, 'p', null), []);
});

test('endpointUrls: 同时兼容带 /v1 与不带 /v1 的 Base URL', () => {
  assert.deepEqual(endpointUrls('https://api.example.com', 'models'), [
    'https://api.example.com/models',
    'https://api.example.com/v1/models',
  ]);
  assert.deepEqual(endpointUrls('https://api.example.com/v1/', '/models'), [
    'https://api.example.com/v1/models',
    'https://api.example.com/models',
  ]);
});

test('discoverEndpointModels: 404 时尝试 /v1 备用路径并保留元数据', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/models') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'deepseek-chat', owned_by: 'deepseek', object: 'model' },
        { id: 'deepseek-reasoner' },
      ],
    }));
  });
  const port = await listenOn(server);
  const models = await discoverEndpointModels({
    baseUrl: `http://127.0.0.1:${port}`,
    apiKey: 'k',
  });
  assert.deepEqual(models, [
    { id: 'deepseek-chat', ownedBy: 'deepseek', object: 'model' },
    { id: 'deepseek-reasoner' },
  ]);
  server.close();
});

function listenOn(server: http.Server): Promise<number> {
  return new Promise((r) => server.listen(0, () => r((server.address() as any).port)));
}

test('mergeConsecutive: 合并相邻同角色', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'a' }] },
    { role: 'user', content: [{ type: 'text', text: 'b' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'c' }] },
  ];
  const out = mergeConsecutive(msgs);
  assert.equal(out.length, 2);
  assert.equal(out[0].content.length, 2);
  assert.equal(out[1].role, 'assistant');
});

/** 起一个 mock OpenAI SSE 服务端，返回文本+分片工具调用+usage，回调返回请求体 */
function mockServer(onBody: (b: any) => void): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      onBody(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunks = [
        { choices: [{ delta: { content: '正在' } }] },
        { choices: [{ delta: { content: '打开…' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'navi' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'gate' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"url":' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"https://x.com"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        { usage: { prompt_tokens: 42, completion_tokens: 7 }, choices: [] },
      ];
      for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as any).port, close: () => server.close() })));
}

test('openaiStream: 流式解析 + 工具分片累积 + usage', async () => {
  let body: any = null;
  const srv = await mockServer((b) => (body = b));
  let streamed = '';
  const result = await openaiStream({
    provider: { id: 'p', name: 'Mock', baseUrl: `http://127.0.0.1:${srv.port}/v1`, apiKey: 'k' },
    model: { id: 'gpt-test', label: 'm', vision: true },
    binding: { id: 'p/gpt-test', modelId: 'gpt-test', providerId: 'p', apiModelName: 'gpt-test' },
    system: 'SYS',
    messages: [{ role: 'user', content: [{ type: 'text', text: '打开 x.com' }] }],
    tools: [{ name: 'navi', description: 'nav', schema: { type: 'object', properties: { url: { type: 'string' } } } }],
    temperature: null,
    maxTokens: 1024,
    signal: new AbortController().signal,
    timeoutMs: 10000,
    retries: 0,
    onText: (d) => (streamed += d),
  });
  srv.close();

  assert.equal(streamed, '正在打开…');
  assert.equal(result.stopReason, 'tool_calls');
  assert.deepEqual(result.usage, { input: 42, output: 7 });
  const call = result.blocks.find((b) => b.type === 'tool_use') as any;
  assert.equal(call.name, 'navigate', '分片工具名拼接');
  assert.deepEqual(call.input, { url: 'https://x.com' }, '分片 JSON 参数解析');
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.stream_options.include_usage, true);
});

test('openaiStream: tool 结果转 tool 消息 + 截图挪到 user', async () => {
  let body: any = null;
  const srv = await mockServer((b) => (body = b));
  await openaiStream({
    provider: { id: 'p', name: 'Mock', baseUrl: `http://127.0.0.1:${srv.port}/v1`, apiKey: 'k' },
    model: { id: 'gpt-test', label: 'm', vision: true },
    binding: { id: 'p/gpt-test', modelId: 'gpt-test', providerId: 'p', apiModelName: 'gpt-test' },
    system: 'SYS',
    messages: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call_0', name: 'navi', input: { url: 'a' } }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'call_0', toolName: 'navi', content: [{ type: 'text', text: '已到达' }, { type: 'image', mediaType: 'image/jpeg', data: 'AAAA' }] }] },
    ],
    tools: [],
    temperature: null,
    maxTokens: 512,
    signal: new AbortController().signal,
    timeoutMs: 10000,
    retries: 0,
    onText: () => {},
  });
  srv.close();

  const asst = body.messages.find((m: any) => m.role === 'assistant' && m.tool_calls);
  assert.equal(asst.tool_calls[0].function.arguments, '{"url":"a"}', 'tool_use 参数被 JSON 字符串化');
  const toolMsg = body.messages.find((m: any) => m.role === 'tool');
  assert.ok(toolMsg.content.includes('已到达'));
  const carrier = body.messages.find((m: any) => m.role === 'user' && Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url'));
  assert.ok(carrier, '截图挪到随后的 user 消息');
});

test('openaiStream: HTTP 错误抛出含状态码', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end('{"error":"bad key"}');
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as any).port;
  await assert.rejects(
    () =>
      openaiStream({
        provider: { id: 'p', name: 'Mock', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'bad' },
        model: { id: 'm', label: 'm', vision: true },
        binding: { id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm' },
        system: 'S',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        temperature: null,
        maxTokens: 100,
        signal: new AbortController().signal,
        timeoutMs: 5000,
        retries: 0,
        onText: () => {},
      }),
    /401/,
  );
  server.close();
});

test('openaiStream: HTTP 200 但非 SSE 时提示检查 /v1', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Web site</title>');
  });
  const port = await listenOn(server);
  await assert.rejects(
    () =>
      openaiStream({
        provider: { id: 'p', name: 'Mock', baseUrl: `http://127.0.0.1:${port}`, apiKey: 'k' },
        model: { id: 'm', label: 'm', vision: false },
        binding: { id: 'p/m', modelId: 'm', providerId: 'p', apiModelName: 'm' },
        system: 'S',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        temperature: null,
        maxTokens: 100,
        signal: new AbortController().signal,
        timeoutMs: 5000,
        retries: 0,
        onText: () => {},
      }),
    /不是 SSE.*\/v1/,
  );
  server.close();
});

// ---------- 退避重试 ----------

test('isRetryableStatus: 5xx/429/408 可重试，4xx 不可', () => {
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(200), false);
});

test('fetchWithRetry: 5xx 重试后成功', async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    if (hits < 3) {
      res.writeHead(503);
      res.end('busy');
    } else {
      res.writeHead(200);
      res.end('ok');
    }
  });
  const port = await listenOn(server);
  const resp = await fetchWithRetry(
    `http://127.0.0.1:${port}/`,
    { method: 'GET' },
    { provider: { ...PROV }, signal: new AbortController().signal, timeoutMs: 5000, retries: 3 },
  );
  assert.equal(resp.status, 200);
  assert.equal(hits, 3, '前两次 503 各重试一次');
  server.close();
});

test('fetchWithRetry: 4xx 立即抛 HttpError 不重试', async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    res.writeHead(401);
    res.end('bad key');
  });
  const port = await listenOn(server);
  await assert.rejects(
    () =>
      fetchWithRetry(
        `http://127.0.0.1:${port}/`,
        { method: 'GET' },
        { provider: { ...PROV }, signal: new AbortController().signal, timeoutMs: 5000, retries: 3 },
      ),
    (e: unknown) => e instanceof HttpError && e.status === 401,
  );
  assert.equal(hits, 1, '4xx 不重试');
  server.close();
});

test('fetchWithRetry: 耗尽重试后抛最后一次错误', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(500);
    res.end('down');
  });
  const port = await listenOn(server);
  await assert.rejects(
    () =>
      fetchWithRetry(
        `http://127.0.0.1:${port}/`,
        { method: 'GET' },
        { provider: { ...PROV }, signal: new AbortController().signal, timeoutMs: 5000, retries: 1 },
      ),
    (e: unknown) => e instanceof HttpError && e.status === 500,
  );
  server.close();
});

// ---------- 错误分类 ----------

test('classifyProviderError: HTTP 状态映射为中文提示', () => {
  assert.match(classifyProviderError(new HttpError(401, 'X', '')), /Key/);
  assert.match(classifyProviderError(new HttpError(404, 'X', '')), /不存在/);
  assert.match(classifyProviderError(new HttpError(429, 'X', '')), /限流/);
  assert.match(classifyProviderError(new HttpError(503, 'X', 'resource unavailable')), /resource unavailable/);
  assert.match(classifyProviderError(new HttpError(400, 'X', 'bad')), /400/);
});

test('readErrorBody: 从兼容接口 JSON 错误中提取可读消息', async () => {
  const resp = new Response('{"error":{"message":"resource unavailable","type":"server_error"}}');
  assert.equal(await readErrorBody(resp), 'resource unavailable');
});

test('classifyProviderError: 取消/超时返回空串，网络错误提示连接', () => {
  assert.equal(classifyProviderError(new DOMException('a', 'AbortError')), '');
  assert.equal(classifyProviderError(new DOMException('t', 'TimeoutError')), '');
  assert.match(classifyProviderError(new TypeError('Failed to fetch')), /无法连接/);
});

test('openaiStream: tool 结果在多个 chunk 重复全量 name 时不被重复拼接', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const chunks = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'navigate', arguments: '{"url":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'navigate', arguments: '"https://x.com"}' } }] } }] },
      { choices: [{ finish_reason: 'tool_calls' }] },
    ];
    for (const c of chunks) res.write('data: ' + JSON.stringify(c) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  });
  const port = await listenOn(server);
  const res = await openaiStream({
    provider: { id: 'p', name: 'Mock', baseUrl: 'http://127.0.0.1:' + port, apiKey: 'k' },
    model: { id: 'm', label: 'M', vision: true },
    binding: { id: 'b', modelId: 'm', providerId: 'p', apiModelName: 'mock' },
    system: 'sys',
    messages: [],
    tools: [{ name: 'navigate', description: 'nav', schema: {} }],
    temperature: 0.7,
    maxTokens: 1000,
    signal: new AbortController().signal,
    timeoutMs: 5000,
    retries: 0,
    onText: () => {},
  });
  assert.equal(res.blocks.length, 1);
  assert.equal(res.blocks[0].type, 'tool_use');
  if (res.blocks[0].type === 'tool_use') {
    assert.equal(res.blocks[0].name, 'navigate');
    assert.deepEqual(res.blocks[0].input, { url: 'https://x.com' });
  }
  server.close();
});
