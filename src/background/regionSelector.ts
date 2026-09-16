// 页面端区域框选器：自包含轻量脚本，注入到页面后提供十字准星与半透明框选交互
export function inPageRegionSelector(): void {
  const g = globalThis as any;
  if (g.__ba_region_active) {
    const existing = document.getElementById('__ba_region_overlay');
    if (existing) existing.remove();
  }
  g.__ba_region_active = true;

  const overlay = document.createElement('div');
  overlay.id = '__ba_region_overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    cursor: 'crosshair',
    userSelect: 'none',
    webkitUserSelect: 'none',
    background: 'rgba(0, 0, 0, 0.22)',
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
  });

  const tip = document.createElement('div');
  tip.textContent = '🎯 拖拽鼠标框选目标区域 / 点击单个元素 / 按 Esc 取消';
  Object.assign(tip.style, {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 23, 42, 0.88)',
    color: '#fff',
    padding: '7px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  });
  overlay.appendChild(tip);

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute',
    border: '2px dashed #3b82f6',
    background: 'rgba(59, 130, 246, 0.15)',
    display: 'none',
    pointerEvents: 'none',
    borderRadius: '4px',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
  });
  overlay.appendChild(box);

  let startX = 0;
  let startY = 0;
  let isDragging = false;

  function cleanup(): void {
    g.__ba_region_active = false;
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    box.style.left = startX + 'px';
    box.style.top = startY + 'px';
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const curX = e.clientX;
    const curY = e.clientY;
    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
  }

  function onMouseUp(e: MouseEvent): void {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;

    let left = Math.min(startX, e.clientX);
    let top = Math.min(startY, e.clientY);
    let width = Math.abs(e.clientX - startX);
    let height = Math.abs(e.clientY - startY);

    // 单击吸附：如果拖拽距离极小，直接检测点击下方的元素矩形
    if (width < 10 && height < 10) {
      overlay.style.display = 'none';
      const hit = document.elementFromPoint(startX, startY);
      overlay.style.display = 'block';
      if (hit && hit !== document.body && hit !== document.documentElement) {
        const interactive = (hit.closest('button, a, input, select, textarea, [role="button"], tr, .card, form, table, [role="region"]') || hit) as HTMLElement;
        const rect = interactive.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          left = Math.round(rect.left);
          top = Math.round(rect.top);
          width = Math.round(rect.width);
          height = Math.round(rect.height);
        }
      }
    }

    // 收集框内 DOM 元素语义摘要
    let elementsSummary = '';
    if (width >= 10 && height >= 10) {
      try {
        const els: string[] = [];
        const all = document.querySelectorAll('button, a, input, textarea, select, h1, h2, h3, p, span, tr, td');
        for (let i = 0; i < all.length && els.length < 15; i++) {
          const el = all[i] as HTMLElement;
          const r = el.getBoundingClientRect();
          if (
            r.right >= left &&
            r.left <= left + width &&
            r.bottom >= top &&
            r.top <= top + height &&
            r.width > 0 &&
            r.height > 0
          ) {
            const text = (el.innerText || el.textContent || (el as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
            if (text && text.length < 80) {
              els.push(`${el.tagName.toLowerCase()}: "${text}"`);
            }
          }
        }
        elementsSummary = els.join('; ');
      } catch {
        /* 忽略 DOM 提取失败 */
      }
    }

    cleanup();

    if (width >= 10 && height >= 10) {
      chrome.runtime.sendMessage({
        type: 'inpage_region_selected',
        rect: {
          x: Math.max(0, left),
          y: Math.max(0, top),
          w: width,
          h: height,
          dpr: window.devicePixelRatio || 1,
        },
        elementsSummary,
      }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({
        type: 'inpage_region_canceled',
      }).catch(() => {});
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({
        type: 'inpage_region_canceled',
      }).catch(() => {});
    }
  }

  overlay.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('keydown', onKeyDown, true);

  document.documentElement.appendChild(overlay);
}
