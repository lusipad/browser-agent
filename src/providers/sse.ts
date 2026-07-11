/** 逐行读取流式响应 */
async function* streamLines(resp: Response): AsyncGenerator<string> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        yield buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
      }
    }
    if (buf) yield buf.replace(/\r$/, '');
  } finally {
    reader.releaseLock();
  }
}

/** 提取 SSE 的 data: 负载（跳过注释与事件名行） */
export async function* sseData(resp: Response): AsyncGenerator<string> {
  for await (const line of streamLines(resp)) {
    if (line.startsWith('data:')) {
      const d = line.slice(5).trim();
      if (d) yield d;
    }
  }
}
