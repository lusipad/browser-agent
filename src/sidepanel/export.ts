// 会话导出：把时间线导出为 Markdown（人类可读）或 JSON（结构化）
import { formatUsd } from '../shared/context';
import type { TimelineItem } from '../shared/types';
import { toolLabel } from './components/toolMeta';

export interface ExportMeta {
  modelLabel: string;
  usage: { input: number; output: number; cost: number | null };
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function usageLine(u: ExportMeta['usage']): string {
  const cost = u.cost != null ? `，成本 ${formatUsd(u.cost)}` : '';
  return `↑${u.input.toLocaleString()} ↓${u.output.toLocaleString()} tokens${cost}`;
}

const STATUS_TEXT: Record<string, string> = { running: '进行中', ok: '成功', error: '失败' };

export function toMarkdown(items: TimelineItem[], meta: ExportMeta): string {
  const lines: string[] = [
    '# Browser Agent 对话记录',
    '',
    `- 模型：${meta.modelLabel}`,
    `- 导出时间：${new Date().toLocaleString()}`,
    `- 用量：${usageLine(meta.usage)}`,
    '',
    '---',
    '',
  ];
  for (const it of items) {
    switch (it.kind) {
      case 'user':
        lines.push(`### 🧑 你`, '', it.text, '');
        break;
      case 'assistant':
        if (it.text.trim()) lines.push(`### 🤖 助手`, '', it.text, '');
        break;
      case 'tool': {
        const st = STATUS_TEXT[it.status] ?? it.status;
        lines.push(`> 🔧 **${toolLabel(it.name)}** \`${it.summary}\` — ${st}`);
        if (it.detail && it.status !== 'running') {
          const oneLine = it.detail.replace(/\s+/g, ' ').slice(0, 300);
          lines.push(`>`, `> ${oneLine}`);
        }
        lines.push('');
        break;
      }
      case 'approval':
        lines.push(`> 🔒 授权：${it.title} — ${it.decision ?? '待处理'}`, '');
        break;
      case 'info':
        lines.push(`> ℹ️ ${it.text}`, '');
        break;
      case 'error':
        lines.push(`> ⚠️ ${it.text}`, '');
        break;
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function toJson(items: TimelineItem[], meta: ExportMeta): string {
  // 去掉体积巨大的 base64 截图，仅保留数量标注
  const slim = items.map((it) => {
    if (it.kind === 'tool' && it.images) {
      const shots = it.images.filter(Boolean).length;
      const { images: _drop, ...rest } = it;
      return shots ? { ...rest, screenshots: shots } : rest;
    }
    return it;
  });
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), model: meta.modelLabel, usage: meta.usage, items: slim },
    null,
    2,
  );
}

export function download(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSession(format: 'md' | 'json', items: TimelineItem[], meta: ExportMeta): void {
  if (format === 'md') {
    download(`browser-agent-${stamp()}.md`, toMarkdown(items, meta), 'text/markdown');
  } else {
    download(`browser-agent-${stamp()}.json`, toJson(items, meta), 'application/json');
  }
}
