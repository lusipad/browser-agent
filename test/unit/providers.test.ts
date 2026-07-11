import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mergeConsecutive } from '../../src/providers/types';
import { openaiStream } from '../../src/providers/openai';
import type { ChatMessage } from '../../src/shared/types';

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
    model: { id: 'p/m', providerId: 'p', model: 'gpt-test', label: 'm', vision: true },
    system: 'SYS',
    messages: [{ role: 'user', content: [{ type: 'text', text: '打开 x.com' }] }],
    tools: [{ name: 'navi', description: 'nav', schema: { type: 'object', properties: { url: { type: 'string' } } } }],
    temperature: null,
    maxTokens: 1024,
    signal: new AbortController().signal,
    timeoutMs: 10000,
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
    model: { id: 'p/m', providerId: 'p', model: 'gpt-test', label: 'm', vision: true },
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
        model: { id: 'p/m', providerId: 'p', model: 'm', label: 'm', vision: true },
        system: 'S',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [],
        temperature: null,
        maxTokens: 100,
        signal: new AbortController().signal,
        timeoutMs: 5000,
        onText: () => {},
      }),
    /401/,
  );
  server.close();
});
