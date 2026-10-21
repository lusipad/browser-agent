// ============================================================
// 注入到页面「隔离世界」执行的自包含函数（read_page / find / form_input …）
//
// 注意：chrome.scripting 会序列化函数源码后注入，函数体内
// 不得引用任何模块级标识符；所有辅助函数必须定义在函数体内部。
//
// 相比玩具版的升级：
//  - 穿透开放 Shadow DOM 与同源 iframe（递归遍历子树）
//  - topRect(): 沿 frame 链实时把元素坐标换算到顶层文档视口 CSS 像素
//  - 数字化 ref，read_page/find 返回结构化 rect 供 set-of-marks 标注
//  - 可见性 / computed style 一律用元素自身的 defaultView，跨 frame 正确
// ============================================================

export async function pageAgent(cmd: string, payload: any): Promise<any> {
  try {
    interface RefMeta {
      role: string;
      name: string;
      tag: string;
      center: { x: number; y: number };
      ts: number;
    }
    const g = globalThis as any;
    if (!g.__ba || !(g.__ba.map instanceof Map)) {
      g.__ba = { seq: 1, map: new Map(), rev: new WeakMap(), meta: new Map() };
    }
    const reg = g.__ba as {
      seq: number;
      map: Map<string, Element>;
      rev: WeakMap<Element, string>;
      meta: Map<string, RefMeta>;
    };
    if (reg.map.size > 8000) {
      reg.map.clear();
      reg.rev = new WeakMap();
      if (reg.meta) reg.meta.clear();
    }
    const topWin = window;
    const topDoc = document;

    // ---------------- 结构化遍历 roots（穿透 open shadow + 同源 iframe） ----------------
    function allRoots(): Array<Document | ShadowRoot> {
      const roots: Array<Document | ShadowRoot> = [];
      function visit(root: Document | ShadowRoot): void {
        if (roots.length > 400) return;
        roots.push(root);
        let els: NodeListOf<Element>;
        try {
          els = root.querySelectorAll('*');
        } catch {
          return;
        }
        for (const el of Array.from(els)) {
          const sr = (el as any).shadowRoot as ShadowRoot | null;
          if (sr) visit(sr);
          if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
            try {
              const cd = (el as HTMLIFrameElement).contentDocument;
              if (cd) visit(cd);
            } catch {
              /* 跨域 iframe 不可读 */
            }
          }
        }
      }
      visit(topDoc);
      return roots;
    }

    // ---------------- 坐标：沿 frame 链换算到顶层文档 ----------------
    function topRect(el: Element): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
      const r = el.getBoundingClientRect();
      let x = r.left;
      let y = r.top;
      let win: any = el.ownerDocument?.defaultView ?? null;
      let guard = 0;
      while (win && win.frameElement && win !== win.parent && guard++ < 25) {
        const fe = win.frameElement as Element;
        const fr = fe.getBoundingClientRect();
        let bl = 0;
        let bt = 0;
        try {
          const cs = win.parent.getComputedStyle(fe);
          bl = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
          bt = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
        } catch {
          /* 跨域父窗口不可读，理论上不会发生（只递归同源 frame） */
        }
        x += fr.left + bl;
        y += fr.top + bt;
        win = win.parent;
      }
      return { left: x, top: y, width: r.width, height: r.height, right: x + r.width, bottom: y + r.height };
    }
    function centerOf(tr: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
      return { x: Math.round(tr.left + tr.width / 2), y: Math.round(tr.top + tr.height / 2) };
    }
    function inTopViewport(tr: { left: number; top: number; right: number; bottom: number }): boolean {
      return tr.bottom > 0 && tr.right > 0 && tr.top < topWin.innerHeight && tr.left < topWin.innerWidth;
    }
    function styleOf(el: Element): CSSStyleDeclaration | null {
      const view = el.ownerDocument?.defaultView;
      try {
        return view ? view.getComputedStyle(el) : null;
      } catch {
        return null;
      }
    }
    function isVisible(el: Element): boolean {
      if (!el.isConnected) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const st = styleOf(el);
      if (!st) return false;
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return false;
      return true;
    }

    // ---------------- ref 自愈与注册表 ----------------
    function findHealingCandidate(meta: RefMeta): Element | null {
      let bestEl: Element | null = null;
      let minDistance = Infinity;

      for (const root of allRoots()) {
        let els: NodeListOf<Element>;
        try {
          els = root.querySelectorAll(meta.tag);
        } catch {
          continue;
        }
        for (const el of Array.from(els)) {
          if (!el.isConnected || !isVisible(el)) continue;
          const candidateRole = roleOf(el) || el.tagName.toLowerCase();
          const candidateName = accName(el);

          const nameMatches = meta.name ? candidateName === meta.name : true;
          const roleMatches = candidateRole === meta.role;

          if (nameMatches && roleMatches) {
            const tr = topRect(el);
            const c = centerOf(tr);
            const dx = c.x - meta.center.x;
            const dy = c.y - meta.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              bestEl = el;
            }
          }
        }
      }
      return minDistance < 500 ? bestEl : null;
    }

    function refFor(el: Element): string {
      let r = reg.rev.get(el);
      if (!r) {
        r = String(reg.seq++);
        reg.rev.set(el, r);
        reg.map.set(r, el);
      }
      try {
        const tr = topRect(el);
        if (!reg.meta) reg.meta = new Map();
        reg.meta.set(r, {
          role: roleOf(el) || el.tagName.toLowerCase(),
          name: accName(el),
          tag: el.tagName.toLowerCase(),
          center: centerOf(tr),
          ts: Date.now(),
        });
      } catch {}
      return r;
    }
    function getRef(ref: unknown): Element {
      const key = String(ref);
      const el = reg.map.get(key);
      if (el && el.isConnected) {
        return el;
      }
      // 自愈回退：在页面内寻找同结构同名节点自愈
      const meta = reg.meta?.get(key);
      if (meta) {
        const candidate = findHealingCandidate(meta);
        if (candidate) {
          reg.map.set(key, candidate);
          reg.rev.set(candidate, key);
          try {
            const tr = topRect(candidate);
            meta.center = centerOf(tr);
            meta.ts = Date.now();
          } catch {}
          return candidate;
        }
      }
      throw new Error(
        `ref "${ref}" not found or stale (the page changed or navigated — call read_page or find again for fresh refs)`,
      );
    }

    // ---------------- 活体视觉高亮反馈 (__baVisuals) ----------------
    function highlightElement(el: Element, label?: string, durationMs = 1200): void {
      try {
        const HOST_ID = '__ba_visuals_host';
        let host = topDoc.getElementById(HOST_ID);
        if (!host) {
          host = topDoc.createElement('div');
          host.id = HOST_ID;
          host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden;';
          (topDoc.body || topDoc.documentElement).appendChild(host);
        }
        const r = topRect(el);
        if (r.width <= 0 || r.height <= 0) return;

        const box = topDoc.createElement('div');
        box.style.cssText = `
          position: fixed;
          left: ${Math.max(0, r.left - 2)}px;
          top: ${Math.max(0, r.top - 2)}px;
          width: ${r.width + 4}px;
          height: ${r.height + 4}px;
          border: 2px solid #3b82f6;
          border-radius: 4px;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.65), inset 0 0 6px rgba(59, 130, 246, 0.25);
          pointer-events: none;
          transition: opacity 0.3s ease-out;
          opacity: 1;
          box-sizing: border-box;
          z-index: 2147483647;
        `;
        if (label) {
          const badge = topDoc.createElement('div');
          badge.textContent = label;
          badge.style.cssText = `
            position: absolute;
            bottom: calc(100% + 4px);
            left: 0;
            background: #2563eb;
            color: #ffffff;
            font-size: 11px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            pointer-events: none;
          `;
          box.appendChild(badge);
        }
        host.appendChild(box);
        setTimeout(() => {
          box.style.opacity = '0';
          setTimeout(() => box.remove(), 350);
        }, Math.max(300, durationMs));
      } catch {}
    }

    function pointerRipple(x: number, y: number, color = '#38bdf8'): void {
      try {
        const HOST_ID = '__ba_visuals_host';
        let host = topDoc.getElementById(HOST_ID);
        if (!host) {
          host = topDoc.createElement('div');
          host.id = HOST_ID;
          host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden;';
          (topDoc.body || topDoc.documentElement).appendChild(host);
        }
        const dot = topDoc.createElement('div');
        dot.style.cssText = `
          position: fixed;
          left: ${Math.round(x) - 4}px;
          top: ${Math.round(y) - 4}px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
          pointer-events: none;
          z-index: 2147483647;
          box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
        `;
        const ring = topDoc.createElement('div');
        ring.style.cssText = `
          position: fixed;
          left: ${Math.round(x) - 18}px;
          top: ${Math.round(y) - 18}px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid ${color};
          pointer-events: none;
          z-index: 2147483647;
          transform: scale(0.3);
          opacity: 1;
          transition: transform 0.45s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.45s ease-out;
          box-sizing: border-box;
        `;
        host.appendChild(dot);
        host.appendChild(ring);
        requestAnimationFrame(() => {
          ring.style.transform = 'scale(1.6)';
          ring.style.opacity = '0';
        });
        setTimeout(() => {
          dot.remove();
          ring.remove();
        }, 500);
      } catch {}
    }

    function updateLiveHud(text?: string, status: 'running' | 'ok' | 'error' | 'hidden' = 'running'): void {
      try {
        const HUD_ID = '__ba_live_hud';
        let hud = topDoc.getElementById(HUD_ID);
        if (status === 'hidden') {
          if (hud) {
            hud.style.opacity = '0';
            hud.style.transform = 'translate(-50%, -10px)';
            setTimeout(() => hud?.remove(), 250);
          }
          return;
        }

        if (!hud) {
          hud = topDoc.createElement('div');
          hud.id = HUD_ID;
          hud.style.cssText = `
            position: fixed;
            top: 14px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            background: rgba(15, 23, 42, 0.90);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #ffffff;
            padding: 6px 14px;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            pointer-events: auto;
            transition: opacity 0.25s ease, transform 0.25s ease;
            opacity: 0;
            transform: translate(-50%, -8px);
          `;

          const dot = topDoc.createElement('span');
          dot.id = '__ba_hud_dot';
          dot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #38bdf8;
            box-shadow: 0 0 8px #38bdf8;
            display: inline-block;
          `;

          const label = topDoc.createElement('span');
          label.id = '__ba_hud_label';
          label.style.cssText = 'max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

          const stopBtn = topDoc.createElement('button');
          stopBtn.textContent = '⏹ 停止';
          stopBtn.style.cssText = `
            background: rgba(239, 68, 68, 0.25);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            outline: none;
            margin-left: 4px;
            transition: background 0.15s ease;
          `;
          stopBtn.onmouseover = () => { stopBtn.style.background = 'rgba(239, 68, 68, 0.45)'; };
          stopBtn.onmouseout = () => { stopBtn.style.background = 'rgba(239, 68, 68, 0.25)'; };
          stopBtn.onclick = (e) => {
            e.stopPropagation();
            try {
              chrome.runtime.sendMessage({ type: 'abort' }).catch(() => {});
            } catch {}
            updateLiveHud('', 'hidden');
          };

          hud.appendChild(dot);
          hud.appendChild(label);
          hud.appendChild(stopBtn);
          (topDoc.body || topDoc.documentElement).appendChild(hud);

          requestAnimationFrame(() => {
            if (hud) {
              hud.style.opacity = '1';
              hud.style.transform = 'translateX(-50%)';
            }
          });
        }

        const label = hud.querySelector('#__ba_hud_label');
        if (label && text) label.textContent = text;
      } catch {}
    }

    async function pageSettle(timeoutMs = 1500, quietMs = 150): Promise<{ settled: boolean; durationMs: number }> {
      const start = Date.now();
      return new Promise((resolve) => {
        let lastMutation = Date.now();
        let timer: any = null;
        let observer: MutationObserver | null = null;

        function checkDone() {
          const now = Date.now();
          if (now - lastMutation >= quietMs || now - start >= timeoutMs) {
            cleanup();
            resolve({ settled: true, durationMs: now - start });
          } else {
            timer = setTimeout(checkDone, Math.max(25, quietMs - (now - lastMutation)));
          }
        }

        function cleanup() {
          if (observer) {
            try { observer.disconnect(); } catch {}
            observer = null;
          }
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }

        try {
          if (typeof MutationObserver !== 'undefined' && (topDoc.body || topDoc.documentElement)) {
            observer = new MutationObserver(() => {
              lastMutation = Date.now();
            });
            observer.observe(topDoc.body || topDoc.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true,
            });
          }
        } catch {}

        timer = setTimeout(checkDone, quietMs);
      });
    }

    // ---------------- 语义信息 ----------------
    function accName(el: Element): string {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const doc = el.ownerDocument;
        const t = labelledby
          .split(/\s+/)
          .map((id) => doc.getElementById(id)?.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (t) return t.slice(0, 100);
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const labels = (el as HTMLInputElement).labels;
        if (labels && labels.length) {
          const t = (labels[0].textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t) return t.slice(0, 100);
        }
        const ph = el.getAttribute('placeholder');
        if (ph && ph.trim()) return ph.trim();
      }
      const alt = el.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();
      if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) return el.value;
      const txt = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (txt) return txt.slice(0, 100);
      const name = el.getAttribute('name');
      if (name) return name;
      return '';
    }
    function roleOf(el: Element): string {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === 'a' && el.hasAttribute('href')) return 'link';
      if (tag === 'button' || tag === 'summary') return 'button';
      if (tag === 'select') return 'select';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        const t = (el as HTMLInputElement).type;
        if (t === 'button' || t === 'submit' || t === 'reset' || t === 'image') return 'button';
        if (t === 'checkbox') return 'checkbox';
        if (t === 'radio') return 'radio';
        if (t === 'range') return 'slider';
        if (t === 'file') return 'filepicker';
        if (t === 'hidden') return '';
        return 'textbox';
      }
      if ((el as HTMLElement).isContentEditable) return 'textbox';
      if (tag === 'option') return 'option';
      if (tag === 'iframe' || tag === 'frame') return 'iframe';
      return '';
    }
    function isInteractive(el: Element): boolean {
      if (roleOf(el)) return true;
      if (el.hasAttribute('onclick')) return true;
      const ti = el.getAttribute('tabindex');
      if (ti !== null && parseInt(ti, 10) >= 0) return true;
      return false;
    }

    // ---------------- 深度遍历（穿透 Shadow DOM + 同源 iframe） ----------------
    interface Ctx {
      inShadow: boolean;
      inFrame: boolean;
    }
    interface Desc {
      el: Element;
      ref: string;
      role: string;
      name: string;
      tr: { left: number; top: number; width: number; height: number; right: number; bottom: number };
      inView: boolean;
      src: 'top' | 'shadow' | 'iframe';
      opaqueFrame?: boolean;
    }

    function gather(limit: number): Desc[] {
      const out: Desc[] = [];
      const added = new Set<Element>();
      let cursorBudget = 2500;

      function consider(el: Element, ctx: Ctx): void {
        if (out.length >= limit) return;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'HEAD') return;
        let ok = isInteractive(el);
        if (!ok && cursorBudget > 0 && (tag === 'DIV' || tag === 'SPAN' || tag === 'LI' || tag === 'IMG' || tag === 'SVG')) {
          cursorBudget--;
          const st = styleOf(el);
          if (st && st.cursor === 'pointer' && !el.closest('a,button,[role],input,select,textarea')) {
            const p = el.parentElement;
            const ps = p ? styleOf(p) : null;
            ok = !ps || ps.cursor !== 'pointer';
          }
        }
        if (!ok || !isVisible(el)) return;
        // 去重：祖先已被收录且可访问名相同 → 视为同一控件
        let dup = false;
        let p = el.parentElement;
        while (p) {
          if (added.has(p)) {
            if (accName(p) === accName(el)) dup = true;
            break;
          }
          p = p.parentElement;
        }
        if (dup) return;
        const tr = topRect(el);
        const src: Desc['src'] = ctx.inFrame ? 'iframe' : ctx.inShadow ? 'shadow' : 'top';
        out.push({ el, ref: refFor(el), role: roleOf(el) || tag.toLowerCase(), name: accName(el), tr, inView: inTopViewport(tr), src });
        added.add(el);
      }

      function visitRoot(root: Document | ShadowRoot, ctx: Ctx): void {
        let walker: TreeWalker;
        try {
          walker = topDoc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        } catch {
          return;
        }
        let node = walker.nextNode();
        while (node && out.length < limit) {
          const el = node as Element;
          consider(el, ctx);
          // 开放 shadow root
          const sr = (el as any).shadowRoot as ShadowRoot | null;
          if (sr) visitRoot(sr, { inShadow: true, inFrame: ctx.inFrame });
          // 同源 iframe
          if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
            let cd: Document | null = null;
            try {
              cd = (el as HTMLIFrameElement).contentDocument;
            } catch {
              cd = null;
            }
            if (cd && cd.body) {
              visitRoot(cd, { inShadow: ctx.inShadow, inFrame: true });
            } else if (isVisible(el)) {
              // 跨域 iframe：整体作为一个可点区域记录，提示模型内容不可读
              const tr = topRect(el);
              if (!added.has(el)) {
                out.push({ el, ref: refFor(el), role: 'iframe', name: '(cross-origin frame)', tr, inView: inTopViewport(tr), src: 'top', opaqueFrame: true });
                added.add(el);
              }
            }
          }
          node = walker.nextNode();
        }
      }

      const rootEl = topDoc.body ?? topDoc.documentElement;
      if (rootEl) visitRoot(topDoc, { inShadow: false, inFrame: false });
      return out;
    }

    function stateBits(d: Desc): string[] {
      const el = d.el;
      const bits: string[] = [];
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') bits.push(el.checked ? 'checked' : 'unchecked');
        else if (el.type === 'password') bits.push('password');
        else if (el.value) bits.push('value=' + JSON.stringify(String(el.value).slice(0, 50)));
      } else if (el instanceof HTMLTextAreaElement && el.value) {
        bits.push('value=' + JSON.stringify(String(el.value).slice(0, 50)));
      } else if (el instanceof HTMLSelectElement) {
        const sel = el.selectedOptions[0];
        bits.push('selected=' + JSON.stringify((sel?.text ?? '').trim().slice(0, 40)));
        const opts = Array.from(el.options).slice(0, 12).map((o) => o.text.replace(/\s+/g, ' ').trim().slice(0, 25));
        bits.push(`options=[${opts.join(' | ')}${el.options.length > 12 ? ' | …' : ''}]`);
      }
      if ((el as HTMLInputElement).disabled) bits.push('disabled');
      if (el instanceof HTMLAnchorElement && el.href) bits.push('href=' + el.href.slice(0, 80));
      const exp = el.getAttribute('aria-expanded');
      if (exp) bits.push('expanded=' + exp);
      if (d.opaqueFrame) bits.push('cross-origin');
      if (!d.inView) bits.push('offscreen');
      return bits;
    }
    function describe(d: Desc): string {
      const c = centerOf(d.tr);
      const bits = stateBits(d);
      return `[${d.ref}] ${d.role}${d.name ? ' "' + d.name + '"' : ''}${bits.length ? ' (' + bits.join(', ') + ')' : ''} @(${c.x},${c.y})`;
    }
    function shortLabel(d: Desc): string {
      const n = d.name.replace(/\s+/g, ' ').trim().slice(0, 28);
      return d.role + (n ? ' ' + n : '');
    }
    /** 序列化的元素描述（供 SW 侧 set-of-marks 使用） */
    function serialize(d: Desc): any {
      const c = centerOf(d.tr);
      const val = (d.el as any).value;
      return {
        ref: d.ref,
        role: d.role,
        name: d.name.slice(0, 60),
        label: shortLabel(d),
        value: typeof val === 'string' && val ? val.slice(0, 60) : undefined,
        x: Math.round(d.tr.left),
        y: Math.round(d.tr.top),
        w: Math.round(d.tr.width),
        h: Math.round(d.tr.height),
        cx: c.x,
        cy: c.y,
        inView: d.inView,
        src: d.src,
      };
    }

    function pageMeta() {
      const scrollMax = Math.max(0, (topDoc.documentElement.scrollHeight || 0) - topWin.innerHeight);
      return {
        url: location.href,
        title: topDoc.title,
        iw: topWin.innerWidth,
        ih: topWin.innerHeight,
        scrollY: Math.round(topWin.scrollY),
        scrollMax: Math.round(scrollMax),
      };
    }

    function headingOutline(maxLines: number): string {
      const lines: string[] = [];
      const hs = topDoc.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (let i = 0; i < hs.length && lines.length < maxLines; i++) {
        const el = hs[i] as HTMLElement;
        if (!isVisible(el)) continue;
        const t = (el.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (t) lines.push('#'.repeat(parseInt(el.tagName[1], 10)) + ' ' + t);
      }
      return lines.join('\n');
    }

    function detectCaptchaChallenge(): string | null {
      try {
        const href = (topWin.location?.href ?? '').toLowerCase();
        if (/recaptcha|turnstile|geetest|challenge|verify-v2|cf-chl-widget/i.test(href)) {
          return 'URL indicates challenge/verification page';
        }
        const sel = [
          'iframe[src*="challenges.cloudflare.com"]',
          'iframe[src*="google.com/recaptcha"]',
          'iframe[src*="recaptcha.net"]',
          'iframe[src*="hcaptcha.com"]',
          'iframe[src*="turing.captcha.qcloud.com"]',
          '#challenge-stage',
          '#cf-challenge-running',
          '.cf-turnstile-wrapper',
          '.g-recaptcha',
          '.geetest_radar_tip',
          '.geetest_popup_wrap',
          '.geetest_holder',
          '.geetest_widget',
          '#tcaptcha_transform',
        ].join(',');
        if (topDoc.querySelector(sel)) {
          return 'Interactive security challenge widget (Turnstile/reCAPTCHA/GeeTest/hCaptcha) detected';
        }
        const body = (topDoc.body?.innerText ?? '').slice(0, 3000).toLowerCase();
        const keywords = [
          '请完成安全验证',
          '滑动滑块完成拼图',
          '拖动滑块',
          '点击完成验证',
          '人机验证',
          'verify you are human',
          'human verification',
          'security check',
          'please verify that you are not a robot',
          'checking your browser before accessing',
        ];
        for (const kw of keywords) {
          if (body.includes(kw)) return `Security verification prompt: "${kw}"`;
        }
      } catch {
        /* 忽略探测异常 */
      }
      return null;
    }

    // ---------------- 各命令 ----------------
    function readPage(filter: string, maxChars: number): any {
      const descs = gather(700);
      const m = pageMeta();
      const header =
        `URL: ${m.url}\nTitle: ${m.title}\n` +
        `Viewport: ${m.iw}x${m.ih} css px | scrollY ${m.scrollY}/${m.scrollMax}` +
        `${m.scrollMax > 0 && m.scrollY < m.scrollMax ? ' (more content below — scroll to see it)' : ''}`;
      const challenge = detectCaptchaChallenge();
      const alert = challenge
        ? `\n\n[⚠️ SECURITY CHALLENGE / CAPTCHA DETECTED: ${challenge}]\nAutomated browser tools cannot solve this. You MUST call "request_human_intervention" with clear instructions to ask the user to solve it.\n`
        : '';
      let body = '';
      if (filter !== 'interactive') {
        const outline = headingOutline(40);
        if (outline) body += `\n\n== Outline ==\n${outline}`;
      }
      body += `\n\n== Interactive elements (${descs.length}${descs.length >= 700 ? ', capped' : ''}) ==\n`;
      body += descs.map(describe).join('\n');
      let text = header + alert + body;
      if (text.length > maxChars) text = text.slice(0, maxChars) + '\n…(truncated — use `find` with a query to locate specific elements)';
      return { text, elements: descs.map(serialize), meta: m };
    }

    function collect(): any {
      const descs = gather(700);
      return { elements: descs.map(serialize), meta: pageMeta() };
    }

    // 轻量存在性探测（供 wait_for 轮询，避免每次全量 gather）
    function probe(query: unknown, text: unknown, selector?: unknown): any {
      let textFound = false;
      const bodyText = (topDoc.body?.innerText ?? '').toLowerCase();
      if (typeof text === 'string' && text.trim()) textFound = bodyText.includes(text.toLowerCase());
      let matchCount = 0;
      const sel = typeof selector === 'string' ? selector.trim() : '';
      if (sel) {
        try {
          matchCount += topDoc.querySelectorAll(sel).length;
        } catch {}
      }
      const q = typeof query === 'string' ? query.toLowerCase().trim() : '';
      if (q) {
        const toks = q.split(/\s+/).filter(Boolean);
        const descs = gather(500);
        matchCount = descs.filter((d) => {
          const hay = (d.name + ' ' + d.role).toLowerCase();
          return hay.includes(q) || (toks.length > 0 && toks.every((t) => hay.includes(t)));
        }).length;
      }
      return { matchCount, textFound };
    }

    function findEls(query: string): any {
      const q = String(query ?? '').toLowerCase().trim();
      if (!q) throw new Error('find: query is required');
      const tokens = q.split(/\s+/).filter(Boolean);
      const scored = gather(700)
        .map((d) => {
          const hay = (
            d.name + ' ' + d.role + ' ' + (d.el.getAttribute('id') ?? '') + ' ' +
            ((d.el as HTMLAnchorElement).href ?? '') + ' ' + (d.el.getAttribute('name') ?? '')
          ).toLowerCase();
          let score = 0;
          if (hay.includes(q)) score += 3;
          const hits = tokens.filter((t) => hay.includes(t)).length;
          if (tokens.length) score += (2 * hits) / tokens.length;
          if (d.inView) score += 0.3;
          return { d, score };
        })
        .filter((x) => x.score >= 1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 14);
      if (!scored.length) {
        return { text: `No interactive elements matched "${query}". Call read_page to list everything, or the element may not be rendered yet.`, elements: [] };
      }
      return { text: `Matches for "${query}":\n` + scored.map((x) => describe(x.d)).join('\n'), elements: scored.map((x) => serialize(x.d)) };
    }

    // ---------------- 交互 ----------------
    function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else (el as any).value = value;
    }
    function scrollElIntoView(el: Element): void {
      try {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
      } catch {
        el.scrollIntoView();
      }
    }
    function descFor(el: Element): string {
      const tr = topRect(el);
      const inFrame = (el.ownerDocument?.defaultView ?? null) !== topWin;
      return describe({ el, ref: refFor(el), role: roleOf(el) || el.tagName.toLowerCase(), name: accName(el), tr, inView: inTopViewport(tr), src: inFrame ? 'iframe' : 'top' });
    }
    function formInput(ref: unknown, value: unknown): any {
      const el = getRef(ref);
      highlightElement(el, `input #${ref}`, 1200);
      scrollElIntoView(el);
      const v = String(value ?? '');
      if (el instanceof HTMLSelectElement) {
        const opts = Array.from(el.options);
        const opt =
          opts.find((o) => o.value === v) ??
          opts.find((o) => o.text.trim() === v.trim()) ??
          opts.find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
        if (!opt) throw new Error(`No option matches "${v}". Available: ${opts.slice(0, 20).map((o) => o.text.trim()).join(' | ')}`);
        el.value = opt.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { text: `Selected "${opt.text.trim()}" in ${descFor(el)}` };
      }
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const want = ['true', '1', 'on', 'yes', 'checked'].includes(v.toLowerCase());
        if (el.type === 'radio') {
          if (!el.checked) el.click();
        } else if (el.checked !== want) {
          el.click();
        }
        return { text: descFor(el) };
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        setNativeValue(el, v);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { text: `Set value (${v.length} chars) on ${descFor(el)}` };
      }
      if ((el as HTMLElement).isContentEditable) {
        (el as HTMLElement).focus();
        el.textContent = v;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        return { text: `Set text on contenteditable ${descFor(el)}` };
      }
      throw new Error(`ref is a <${el.tagName.toLowerCase()}>, not an editable form element`);
    }
    function elementInfo(ref: unknown, maxAncestors = 0): any {
      const el = getRef(ref);
      const tr = topRect(el);
      const c = centerOf(tr);
      const res: any = {
        x: c.x,
        y: c.y,
        inViewport: inTopViewport(tr),
        visible: isVisible(el),
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
        isFileInput: el instanceof HTMLInputElement && el.type === 'file',
        disabled: !!(el as HTMLInputElement).disabled,
        desc: descFor(el),
      };
      const limit = Math.min(8, Math.max(0, Number(maxAncestors || 0)));
      if (limit > 0) {
        const ancestors: any[] = [];
        let curr: Element | null = el.parentElement;
        let count = 0;
        while (curr && count++ < limit) {
          const st = styleOf(curr);
          const r = curr.getBoundingClientRect();
          ancestors.push({
            tag: curr.tagName.toLowerCase(),
            role: roleOf(curr) || curr.getAttribute('role') || undefined,
            id: curr.id || undefined,
            className: typeof curr.className === 'string' ? curr.className.slice(0, 80) : undefined,
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            scrollable: curr.scrollHeight > curr.clientHeight + 10,
            overflowY: st?.overflowY,
            pointerEvents: st?.pointerEvents,
          });
          curr = curr.parentElement || ((curr.getRootNode() as ShadowRoot)?.host as Element | null);
        }
        res.ancestors = ancestors;
      }
      return res;
    }
    function scrollToRef(ref: unknown): any {
      const el = getRef(ref);
      highlightElement(el, `scroll #${ref}`, 1200);
      scrollElIntoView(el);
      const c = centerOf(topRect(el));
      return { text: `Scrolled to ${descFor(el)}`, x: c.x, y: c.y };
    }
    function focusRef(ref: unknown): any {
      const el = getRef(ref) as HTMLElement;
      scrollElIntoView(el);
      el.focus();
      const c = centerOf(topRect(el));
      return { x: c.x, y: c.y, isPassword: el instanceof HTMLInputElement && el.type === 'password' };
    }
    function activeInfo(): any {
      // 穿透 shadow root 找真正的活动元素
      let el: Element | null = topDoc.activeElement;
      let guard = 0;
      while (el && (el as any).shadowRoot && (el as any).shadowRoot.activeElement && guard++ < 20) {
        el = (el as any).shadowRoot.activeElement;
      }
      if (!el || el === topDoc.body) return { focused: false, isPassword: false };
      return {
        focused: true,
        tag: el.tagName.toLowerCase(),
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
        editable: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable,
      };
    }
    function upload(ref: unknown, b64: string, name: string, mime: string, mode: string): any {
      const el = getRef(ref);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], name || 'upload.bin', { type: mime || 'application/octet-stream' });
      const dt = new DataTransfer();
      dt.items.add(file);
      if (mode === 'drop') {
        const c = centerOf(topRect(el));
        for (const type of ['dragenter', 'dragover', 'drop']) {
          el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: c.x, clientY: c.y }));
        }
        return { text: `Dispatched drag-and-drop of "${file.name}" (${file.size} bytes) onto ${descFor(el)}` };
      }
      let input: HTMLInputElement | null = null;
      if (el instanceof HTMLInputElement && el.type === 'file') input = el;
      else input = el.querySelector('input[type=file]');
      if (!input) throw new Error('Target is not a file input and contains none. Try mode:"drop" on the dropzone element.');
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { text: `Attached file "${file.name}" (${file.size} bytes) to ${descFor(input)}` };
    }

    // ---------------- 主滚动容器探测与智能无感抽文 ----------------
    function findMainScrollContainer(): Element {
      const docEl = topDoc.scrollingElement || topDoc.documentElement || topDoc.body;
      const winH = topWin.innerHeight || 800;
      const winW = topWin.innerWidth || 1200;

      let bestEl: Element | null = null;
      let bestArea = 0;

      for (const root of allRoots()) {
        let els: NodeListOf<Element>;
        try {
          els = root.querySelectorAll('div, section, main, article, ul, [role="feed"], [role="main"], [role="region"]');
        } catch {
          continue;
        }
        for (const el of Array.from(els)) {
          if (!el.isConnected) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 200 || r.height < 150) continue;
          if (el.scrollHeight <= el.clientHeight + 80) continue;
          const st = styleOf(el);
          if (!st) continue;
          const oy = st.overflowY;
          if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
            const area = r.width * r.height;
            if (area > bestArea) {
              bestArea = area;
              bestEl = el;
            }
          }
        }
      }

      if (bestEl && bestArea > winW * winH * 0.35) {
        return bestEl;
      }
      return docEl;
    }

    async function smartScrollRead(maxScreens = 12, stepTimeoutMs = 250): Promise<any> {
      const container = findMainScrollContainer() as HTMLElement;
      const isDoc = container === topDoc.scrollingElement || container === topDoc.documentElement || container === topDoc.body;
      const initialScrollTop = isDoc ? (topWin.scrollY || container.scrollTop || 0) : container.scrollTop;

      const collectedLines = new Set<string>();
      let screens = 0;
      let stalled = false;
      let renderFrozen = false;
      let endlessFeed = false;
      let lastTextLen = 0;
      let freezeCount = 0;

      function extractLines(rootEl: Element): string[] {
        const raw = ((rootEl as HTMLElement).innerText ?? rootEl.textContent ?? '').trim();
        return raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
      }

      try {
        const targetReadEl = isDoc ? (topDoc.body || topDoc.documentElement) : container;
        for (const l of extractLines(targetReadEl)) {
          collectedLines.add(l);
        }
        screens = 1;
        lastTextLen = Array.from(collectedLines).join('\n').length;

        const max = Math.min(25, Math.max(1, Number(maxScreens ?? 12)));
        const clientHeight = isDoc ? topWin.innerHeight : container.clientHeight;
        const step = Math.max(200, Math.round(clientHeight * 0.85));

        while (screens < max) {
          const currentScrollTop = isDoc ? (topWin.scrollY || container.scrollTop || 0) : container.scrollTop;
          const scrollHeight = isDoc ? (topDoc.documentElement.scrollHeight || topDoc.body?.scrollHeight || 0) : container.scrollHeight;

          if (currentScrollTop + clientHeight >= scrollHeight - 15) {
            break;
          }

          const targetScrollTop = currentScrollTop + step;
          if (isDoc) {
            topWin.scrollTo({ top: targetScrollTop, behavior: 'instant' as ScrollBehavior });
          } else {
            container.scrollTop = targetScrollTop;
          }

          const afterScrollTop = isDoc ? (topWin.scrollY || container.scrollTop || 0) : container.scrollTop;
          if (Math.abs(afterScrollTop - currentScrollTop) < 2) {
            stalled = true;
            break;
          }

          const waitLimit = Math.min(600, Math.max(50, Number(stepTimeoutMs ?? 250)));
          const pollStart = Date.now();
          let grown = false;
          while (Date.now() - pollStart < waitLimit) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            const freshLines = extractLines(targetReadEl);
            let added = false;
            for (const l of freshLines) {
              if (!collectedLines.has(l)) {
                collectedLines.add(l);
                added = true;
              }
            }
            if (added) {
              grown = true;
              break;
            }
          }

          screens++;
          const currentTotalLen = Array.from(collectedLines).join('\n').length;
          if (!grown || currentTotalLen === lastTextLen) {
            freezeCount++;
            if (freezeCount >= 2) {
              renderFrozen = true;
              break;
            }
          } else {
            freezeCount = 0;
            lastTextLen = currentTotalLen;
          }

          if (screens >= 20 && scrollHeight > clientHeight * 10) {
            endlessFeed = true;
            break;
          }
        }
      } finally {
        try {
          if (isDoc) {
            topWin.scrollTo({ top: initialScrollTop, behavior: 'instant' as ScrollBehavior });
          } else {
            container.scrollTop = initialScrollTop;
          }
        } catch {}
      }

      const text = Array.from(collectedLines).join('\n');
      return {
        text,
        screens,
        totalChars: text.length,
        scrollHeight: isDoc ? (topDoc.documentElement.scrollHeight || topDoc.body?.scrollHeight || 0) : container.scrollHeight,
        backgroundTab: !!topDoc.hidden,
        stalled,
        renderFrozen,
        endlessFeed,
        containerTag: container.tagName.toLowerCase(),
      };
    }

    function highlightCmd(ref: unknown, label?: unknown, duration?: unknown): any {
      const el = getRef(ref);
      const text = label ? String(label) : descFor(el);
      const dur = duration ? Math.min(10000, Math.max(300, Number(duration))) : 1500;
      highlightElement(el, text, dur);
      return { text: `Highlighted ${descFor(el)} for ${dur}ms` };
    }
    function deepQueryAll(sel: string, cap: number): Element[] {
      const found: Element[] = [];
      for (const root of allRoots()) {
        try {
          for (const el of Array.from(root.querySelectorAll(sel))) {
            found.push(el);
            if (found.length >= cap) return found;
          }
        } catch {
          /* 非法选择器 */
        }
      }
      return found;
    }
    function cleanText(s: string | null | undefined, max: number): string {
      return (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    }
    function extractTables(): any[] {
      return deepQueryAll('table', 30).map((t) => {
        const caption = cleanText(t.querySelector('caption')?.textContent, 200);
        let headers: string[] = [];
        const body: string[][] = [];
        const trs = Array.from(t.querySelectorAll('tr')).slice(0, 300);
        trs.forEach((tr, i) => {
          const cells = Array.from(tr.querySelectorAll('th,td')).map((c) => cleanText(c.textContent, 300));
          if (!cells.length) return;
          if (i === 0 && tr.querySelector('th') && !headers.length) headers = cells;
          else body.push(cells);
        });
        return { caption, headers, rows: body };
      });
    }
    function extractLinks(): any[] {
      const seen = new Set<string>();
      const out: Array<{ text: string; href: string }> = [];
      for (const a of deepQueryAll('a[href]', 1000)) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || href.startsWith('javascript:') || seen.has(href)) continue;
        seen.add(href);
        out.push({ text: cleanText(a.textContent, 160), href });
        if (out.length >= 300) break;
      }
      return out;
    }
    function pickField(el: Element, spec: string): string | null {
      let sel = spec;
      let attr = '';
      const at = spec.lastIndexOf('@');
      if (at >= 0) {
        sel = spec.slice(0, at);
        attr = spec.slice(at + 1);
      }
      let target: Element | null = el;
      if (sel) target = el.querySelector(sel);
      if (!target) return null;
      if (attr) {
        if (attr === 'href' || attr === 'src') return (target as any)[attr] || target.getAttribute(attr);
        return target.getAttribute(attr);
      }
      return cleanText(target.textContent, 600);
    }
    function extractSelector(selector: string, fields: Record<string, string> | null): any[] {
      const els = deepQueryAll(selector, 300);
      return els.map((el) => {
        if (!fields) return cleanText(el.textContent, 600);
        const obj: Record<string, string | null> = {};
        for (const [name, spec] of Object.entries(fields)) obj[name] = pickField(el, String(spec));
        return obj;
      });
    }
    function extractAutoCards(): any[] {
      const candidates: Array<{ container: Element; children: Element[]; score: number }> = [];
      const walker = topDoc.createTreeWalker(topDoc.body || topDoc.documentElement, 1 /* NodeFilter.SHOW_ELEMENT */);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'svg', 'path', 'nav', 'footer', 'header'].includes(tag)) continue;
        const children = Array.from(el.children).filter((c) => {
          const t = c.tagName.toLowerCase();
          return !['script', 'style'].includes(t) && isVisible(c);
        });
        if (children.length >= 3 && children.length <= 150) {
          const firstTag = children[0].tagName;
          const sameTagCount = children.filter((c) => c.tagName === firstTag).length;
          if (sameTagCount >= children.length * 0.7) {
            const avgTextLen = children.reduce((acc, c) => acc + (c.textContent || '').trim().length, 0) / children.length;
            if (avgTextLen >= 10 && avgTextLen <= 2500) {
              candidates.push({
                container: el,
                children,
                score: children.length * Math.min(avgTextLen, 250),
              });
            }
          }
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best) return [];

      return best.children.slice(0, 80).map((card, idx) => {
        const titleEl = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="name" i], strong, a');
        const rawFirstLine = (card.textContent || '').trim().split('\n')[0]?.trim();
        const title = cleanText(titleEl?.textContent || rawFirstLine, 150);
        const linkEl = (card.tagName.toLowerCase() === 'a' ? card : card.querySelector('a[href]')) as HTMLAnchorElement | null;
        const link = linkEl?.href && !linkEl.href.startsWith('javascript:') ? linkEl.href : undefined;
        const imgEl = card.querySelector('img[src]') as HTMLImageElement | null;
        const image = imgEl?.src && !imgEl.src.startsWith('data:') ? imgEl.src : undefined;
        const fullText = cleanText(card.textContent, 500);
        const priceMatch = fullText.match(/(?:[$¥￥€£]\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:元|USD|EUR|CNY))/i);
        const price = priceMatch ? priceMatch[0].trim() : undefined;

        return {
          index: idx + 1,
          title: title || undefined,
          price,
          link,
          image,
          text: fullText,
        };
      });
    }

    function extractData(p: any): any {
      const mode = String(p?.mode || (p?.selector ? 'selector' : topDoc.querySelector('table') ? 'tables' : 'auto_cards'));
      if (mode === 'tables') {
        const tables = extractTables();
        return { mode, count: tables.length, tables };
      }
      if (mode === 'links') {
        const links = extractLinks();
        return { mode, count: links.length, links };
      }
      if (mode === 'auto_cards') {
        const cards = extractAutoCards();
        return { mode, count: cards.length, cards };
      }
      const selector = String(p?.selector ?? '');
      if (!selector) throw new Error('extract_data: "selector" is required for selector mode');
      const fields = p?.fields && typeof p.fields === 'object' ? (p.fields as Record<string, string>) : null;
      const items = extractSelector(selector, fields);
      return { mode: 'selector', selector, count: items.length, items };
    }

    switch (cmd) {
      case 'read_page':
        return readPage(String(payload?.filter ?? 'interactive'), Number(payload?.max_chars ?? 16000));
      case 'extract':
        return extractData(payload);
      case 'collect':
        return collect();
      case 'probe':
        return probe(payload?.query, payload?.text, payload?.selector);
      case 'find':
        return findEls(payload?.query);
      case 'form_input':
        return formInput(payload?.ref, payload?.value);
      case 'element_info':
        return elementInfo(payload?.ref, payload?.max_ancestors);
      case 'scroll_to':
        return scrollToRef(payload?.ref);
      case 'focus':
        return focusRef(payload?.ref);
      case 'active_info':
        return activeInfo();
      case 'upload':
        return upload(payload?.ref, payload?.b64, payload?.name, payload?.mime, payload?.mode ?? 'change');
      case 'highlight':
        return highlightCmd(payload?.ref, payload?.label, payload?.duration);
      case 'smart_scroll_read':
        return await smartScrollRead(payload?.max_screens, payload?.step_timeout_ms);
      case 'hud_update':
        updateLiveHud(payload?.text, payload?.status);
        return { ok: true };
      case 'page_settle':
        return await pageSettle(Number(payload?.timeoutMs ?? 1500), Number(payload?.quietMs ?? 150));
      case 'pointer_ripple':
        pointerRipple(payload?.x, payload?.y, payload?.color);
        return { ok: true };
      default:
        throw new Error('pageAgent: unknown cmd ' + cmd);
    }
  } catch (e) {
    return { __error: e instanceof Error ? e.message : String(e) };
  }
}

/** 供 allFrames 文本提取使用的独立自包含函数 */
export function pageTextFrame(): { url: string; title: string; text: string } {
  const t = (document.body?.innerText ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { url: location.href, title: document.title, text: t };
}
