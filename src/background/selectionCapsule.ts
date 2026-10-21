// ============================================================
// 网页内划词轻量交互胶囊 (In-Page Selection Capsule)
// 注入页面后监听文本划选，以独立 Shadow DOM 浮现优雅快捷操作条
// ============================================================

export function inPageSelectionCapsule(): void {
  const g = globalThis as any;
  if (g.__ba_selection_capsule_active) return;
  g.__ba_selection_capsule_active = true;

  const HOST_ID = '__ba_selection_capsule_host';

  function removeCapsule(): void {
    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();
  }

  let timer: any = null;

  function onSelectionChange(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(checkSelection, 120);
  }

  function checkSelection(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      removeCapsule();
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2 || text.length > 5000) {
      removeCapsule();
      return;
    }

    let range: Range;
    try {
      range = sel.getRangeAt(0);
    } catch {
      removeCapsule();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      removeCapsule();
      return;
    }

    renderCapsule(rect, text);
  }

  function renderCapsule(rect: DOMRect, selectedText: string): void {
    removeCapsule();

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: auto;';

    const shadow = host.attachShadow({ mode: 'open' });
    const capsule = document.createElement('div');

    const topPos = window.scrollY + rect.bottom + 8;
    const leftPos = Math.max(12, Math.min(window.innerWidth - 260, window.scrollX + rect.left + rect.width / 2 - 120));

    capsule.style.cssText = `
      position: absolute;
      top: ${topPos}px;
      left: ${leftPos}px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 12px;
      line-height: 1;
      color: #f1f5f9;
      user-select: none;
      -webkit-user-select: none;
      animation: baCapsuleFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      pointer-events: auto;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes baCapsuleFadeIn {
        from { opacity: 0; transform: translateY(-4px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .ba-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 9px;
        background: transparent;
        color: #f8fafc;
        border: none;
        border-radius: 14px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease;
        white-space: nowrap;
      }
      .ba-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .ba-btn:active {
        transform: scale(0.96);
      }
      .ba-divider {
        width: 1px;
        height: 14px;
        background: rgba(255, 255, 255, 0.18);
        margin: 0 1px;
      }
    `;
    shadow.appendChild(style);

    const btnAsk = document.createElement('button');
    btnAsk.className = 'ba-btn';
    btnAsk.innerHTML = '<span>✨</span><span>问 Agent</span>';
    btnAsk.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('ask', selectedText);
    };

    const btnTranslate = document.createElement('button');
    btnTranslate.className = 'ba-btn';
    btnTranslate.innerHTML = '<span>🌐</span><span>翻译</span>';
    btnTranslate.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('translate', selectedText);
    };

    const btnExtract = document.createElement('button');
    btnExtract.className = 'ba-btn';
    btnExtract.innerHTML = '<span>📊</span><span>结构化</span>';
    btnExtract.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('extract', selectedText);
    };

    const div1 = document.createElement('div');
    div1.className = 'ba-divider';
    const div2 = document.createElement('div');
    div2.className = 'ba-divider';

    capsule.appendChild(btnAsk);
    capsule.appendChild(div1);
    capsule.appendChild(btnTranslate);
    capsule.appendChild(div2);
    capsule.appendChild(btnExtract);

    shadow.appendChild(capsule);
    (document.body || document.documentElement).appendChild(host);
  }

  function triggerAction(action: 'ask' | 'translate' | 'extract', text: string): void {
    removeCapsule();
    try {
      chrome.runtime.sendMessage({
        type: 'inpage_selection_action',
        action,
        text,
        url: location.href,
        title: document.title,
      });
    } catch {
      /* 扩展更新或失活 */
    }
  }

  document.addEventListener('selectionchange', onSelectionChange, true);
  document.addEventListener('mousedown', (e) => {
    const host = document.getElementById(HOST_ID);
    if (host && !host.contains(e.target as Node)) {
      removeCapsule();
    }
  }, true);
  window.addEventListener('scroll', () => {
    if (timer) clearTimeout(timer);
    removeCapsule();
  }, { passive: true });
}
