// 示教学习录制器：在用户手动操作时无感捕获动作流并提炼语义
import type { DemonstratedAction } from '../shared/types';
import { truncate } from '../shared/util';

/** 注入到被示教页面执行的轻量事件捕获脚本（自包含函数） */
export function inPageRecorder(): void {
  const g = globalThis as any;
  if (g.__ba_recorder_active) return;
  g.__ba_recorder_active = true;

  function describeElement(el: HTMLElement | null): DemonstratedAction['target'] {
    if (!el) return undefined;
    const tag = el.tagName.toLowerCase();
    let text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const placeholder = (el as HTMLInputElement).placeholder || undefined;
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || undefined;
    let label: string | undefined = undefined;
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) label = (lbl.textContent || '').trim().slice(0, 80);
    }
    const isPassword = (el as HTMLInputElement).type === 'password';
    const role = el.getAttribute('role') || undefined;

    // 如果当前元素本身无文字，向上找一层按钮或链接文字
    if (!text) {
      const parent = el.closest('button, a, [role="button"]');
      if (parent) {
        text = (parent.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
      }
    }

    return {
      tag,
      text: text || undefined,
      placeholder,
      label: ariaLabel || label,
      role,
      isPassword,
    };
  }

  function emitAction(act: DemonstratedAction): void {
    try {
      chrome.runtime.sendMessage({
        type: 'recorder_action',
        action: act,
      }).catch(() => {});
    } catch {
      /* 忽略扩展上下文失效 */
    }
  }

  // 1. 点击捕获 (优先锁定可交互容器)
  document.addEventListener('click', (e) => {
    // 忽略右键或非主键点击
    if (e.button !== 0) return;
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;

    const interactive = rawTarget.closest('button, a, input, select, textarea, [role="button"], [role="checkbox"], [role="tab"], [role="radio"], [role="menuitem"], .btn, li, tr') as HTMLElement | null;
    const target = interactive || rawTarget;
    const desc = describeElement(target);

    emitAction({
      type: 'click',
      url: location.href,
      title: document.title,
      timestamp: Date.now(),
      target: desc,
    });
  }, true);

  // 2. 输入捕获 (防抖，避免每次击键都记录)
  let inputTimer: any = null;
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || !('value' in target)) return;
    if (target.type === 'file') return;

    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      const desc = describeElement(target);
      const val = desc?.isPassword ? '******' : String(target.value).trim();
      emitAction({
        type: 'input',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        target: desc,
        value: val,
      });
    }, 400);
  }, true);

  // 3. 文件 / 图片上传捕获
  document.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | null;
    if (target && target.type === 'file' && target.files && target.files.length > 0) {
      const file = target.files[0];
      const desc = describeElement(target);
      emitAction({
        type: 'upload',
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        target: desc,
        value: file.name,
        fileInfo: {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
        },
      });
    }
  }, true);
}

/** 将人类原始示教动作流格式化为供 LLM 提炼的清晰轨迹文本 */
export function formatDemonstratedTrajectory(actions: DemonstratedAction[]): string {
  if (!actions.length) return 'No actions recorded.';

  const cleaned: DemonstratedAction[] = [];
  // 过滤多余的中间连击/连续输入（同一目标连续 input 保留最后一次）
  for (let i = 0; i < actions.length; i++) {
    const cur = actions[i];
    const next = actions[i + 1];
    if (
      cur.type === 'input' &&
      next &&
      next.type === 'input' &&
      cur.target?.placeholder === next.target?.placeholder &&
      cur.target?.label === next.target?.label
    ) {
      continue;
    }
    cleaned.push(cur);
  }

  const lines: string[] = [];
  let step = 0;

  for (const act of cleaned) {
    step++;
    const desc = act.target;
    let targetSummary = desc?.tag || 'element';
    if (desc?.label) targetSummary += ` [label="${desc.label}"]`;
    if (desc?.placeholder) targetSummary += ` [placeholder="${desc.placeholder}"]`;
    if (desc?.text) targetSummary += ` "${truncate(desc.text, 40)}"`;

    switch (act.type) {
      case 'navigate':
        lines.push(`Step ${step}: Navigate to "${act.url}" (${act.title})`);
        break;
      case 'click':
        lines.push(`Step ${step}: Click ${targetSummary} on ${act.url}`);
        break;
      case 'input':
        lines.push(`Step ${step}: Type "${act.value ?? ''}" into ${targetSummary}`);
        break;
      case 'upload':
        lines.push(`Step ${step}: Upload file "${act.fileInfo?.name || act.value}" (${act.fileInfo?.type || 'file'}, ${act.fileInfo?.size || 0} bytes) into ${targetSummary}`);
        break;
    }
  }

  return lines.join('\n');
}
