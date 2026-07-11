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

export function pageAgent(cmd: string, payload: any): any {
  try {
    const g = globalThis as any;
    if (!g.__ba || !(g.__ba.map instanceof Map)) {
      g.__ba = { seq: 1, map: new Map(), rev: new WeakMap() };
    }
    const reg = g.__ba as { seq: number; map: Map<string, Element>; rev: WeakMap<Element, string> };
    if (reg.map.size > 8000) {
      reg.map.clear();
      reg.rev = new WeakMap();
    }
    const topWin = window;
    const topDoc = document;

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

    // ---------------- ref 注册表 ----------------
    function refFor(el: Element): string {
      let r = reg.rev.get(el);
      if (!r) {
        r = String(reg.seq++);
        reg.rev.set(el, r);
        reg.map.set(r, el);
      }
      return r;
    }
    function getRef(ref: unknown): Element {
      const el = reg.map.get(String(ref));
      if (!el || !el.isConnected) {
        throw new Error(
          `ref "${ref}" not found or stale (the page changed or navigated — call read_page or find again for fresh refs)`,
        );
      }
      return el;
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
    interface Desc {
      el: Element;
      ref: string;
      role: string;
      name: string;
      tr: { left: number; top: number; width: number; height: number; right: number; bottom: number };
      inView: boolean;
      opaqueFrame?: boolean;
    }

    function gather(limit: number): Desc[] {
      const out: Desc[] = [];
      const added = new Set<Element>();
      let cursorBudget = 2500;

      function consider(el: Element): void {
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
        out.push({ el, ref: refFor(el), role: roleOf(el) || tag.toLowerCase(), name: accName(el), tr, inView: inTopViewport(tr) });
        added.add(el);
      }

      function visitRoot(root: Document | ShadowRoot): void {
        let walker: TreeWalker;
        try {
          walker = topDoc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        } catch {
          return;
        }
        let node = walker.nextNode();
        while (node && out.length < limit) {
          const el = node as Element;
          consider(el);
          // 开放 shadow root
          const sr = (el as any).shadowRoot as ShadowRoot | null;
          if (sr) visitRoot(sr);
          // 同源 iframe
          if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
            let cd: Document | null = null;
            try {
              cd = (el as HTMLIFrameElement).contentDocument;
            } catch {
              cd = null;
            }
            if (cd && cd.body) {
              visitRoot(cd);
            } else if (isVisible(el)) {
              // 跨域 iframe：整体作为一个可点区域记录，提示模型内容不可读
              const tr = topRect(el);
              if (!added.has(el)) {
                out.push({ el, ref: refFor(el), role: 'iframe', name: '(cross-origin frame)', tr, inView: inTopViewport(tr), opaqueFrame: true });
                added.add(el);
              }
            }
          }
          node = walker.nextNode();
        }
      }

      const rootEl = topDoc.body ?? topDoc.documentElement;
      if (rootEl) visitRoot(topDoc);
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
      return {
        ref: d.ref,
        role: d.role,
        name: d.name.slice(0, 60),
        label: shortLabel(d),
        x: Math.round(d.tr.left),
        y: Math.round(d.tr.top),
        w: Math.round(d.tr.width),
        h: Math.round(d.tr.height),
        cx: c.x,
        cy: c.y,
        inView: d.inView,
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

    // ---------------- 各命令 ----------------
    function readPage(filter: string, maxChars: number): any {
      const descs = gather(700);
      const m = pageMeta();
      const header =
        `URL: ${m.url}\nTitle: ${m.title}\n` +
        `Viewport: ${m.iw}x${m.ih} css px | scrollY ${m.scrollY}/${m.scrollMax}` +
        `${m.scrollMax > 0 && m.scrollY < m.scrollMax ? ' (more content below — scroll to see it)' : ''}`;
      let body = '';
      if (filter !== 'interactive') {
        const outline = headingOutline(40);
        if (outline) body += `\n\n== Outline ==\n${outline}`;
      }
      body += `\n\n== Interactive elements (${descs.length}${descs.length >= 700 ? ', capped' : ''}) ==\n`;
      body += descs.map(describe).join('\n');
      let text = header + body;
      if (text.length > maxChars) text = text.slice(0, maxChars) + '\n…(truncated — use `find` with a query to locate specific elements)';
      return { text, elements: descs.map(serialize), meta: m };
    }

    function collect(): any {
      const descs = gather(700);
      return { elements: descs.map(serialize), meta: pageMeta() };
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
      return describe({ el, ref: refFor(el), role: roleOf(el) || el.tagName.toLowerCase(), name: accName(el), tr, inView: inTopViewport(tr) });
    }
    function formInput(ref: unknown, value: unknown): any {
      const el = getRef(ref);
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
    function elementInfo(ref: unknown): any {
      const el = getRef(ref);
      const tr = topRect(el);
      const c = centerOf(tr);
      return {
        x: c.x,
        y: c.y,
        inViewport: inTopViewport(tr),
        visible: isVisible(el),
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
        isFileInput: el instanceof HTMLInputElement && el.type === 'file',
        disabled: !!(el as HTMLInputElement).disabled,
        desc: descFor(el),
      };
    }
    function scrollToRef(ref: unknown): any {
      const el = getRef(ref);
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

    switch (cmd) {
      case 'read_page':
        return readPage(String(payload?.filter ?? 'interactive'), Number(payload?.max_chars ?? 16000));
      case 'collect':
        return collect();
      case 'find':
        return findEls(payload?.query);
      case 'form_input':
        return formInput(payload?.ref, payload?.value);
      case 'element_info':
        return elementInfo(payload?.ref);
      case 'scroll_to':
        return scrollToRef(payload?.ref);
      case 'focus':
        return focusRef(payload?.ref);
      case 'active_info':
        return activeInfo();
      case 'upload':
        return upload(payload?.ref, payload?.b64, payload?.name, payload?.mime, payload?.mode ?? 'change');
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
