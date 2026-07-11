// ============================================================
// 注入到页面「隔离世界」执行的自包含函数（read_page / find / form_input …）
// 注意：chrome.scripting 会序列化函数源码后注入，函数体内
// 不得引用任何模块级标识符；所有辅助函数必须定义在函数体内部。
// 元素 ref 注册表挂在隔离世界的 globalThis 上，页面导航后自动失效。
// ============================================================

export function pageAgent(cmd: string, payload: any): any {
  try {
    const g = globalThis as any;
    if (!g.__ba || !(g.__ba.map instanceof Map)) {
      g.__ba = { seq: 1, map: new Map(), rev: new WeakMap() };
    }
    const reg = g.__ba as { seq: number; map: Map<string, Element>; rev: WeakMap<Element, string> };
    if (reg.map.size > 5000) {
      reg.map.clear();
      reg.rev = new WeakMap();
    }
    const win = window;
    const doc = document;

    // ---------------- 基础 ----------------
    function isVisible(el: Element): boolean {
      if (!el.isConnected) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const st = win.getComputedStyle(el as HTMLElement);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return false;
      return true;
    }
    function inViewport(r: DOMRect): boolean {
      return r.bottom > 0 && r.right > 0 && r.top < win.innerHeight && r.left < win.innerWidth;
    }
    function center(r: DOMRect): { x: number; y: number } {
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }
    function refFor(el: Element): string {
      let r = reg.rev.get(el);
      if (!r) {
        r = 'e' + reg.seq++;
        reg.rev.set(el, r);
        reg.map.set(r, el);
      }
      return r;
    }
    function getRef(ref: unknown): Element {
      const el = reg.map.get(String(ref));
      if (!el || !el.isConnected) {
        throw new Error(
          `ref "${ref}" not found or stale (the page may have changed or navigated — call read_page or find again to get fresh refs)`,
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
        const t = labelledby
          .split(/\s+/)
          .map((id) => doc.getElementById(id)?.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (t) return t.slice(0, 80);
      }
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        if (el.labels && el.labels.length) {
          const t = (el.labels[0].textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t) return t.slice(0, 80);
        }
        const ph = el.getAttribute('placeholder');
        if (ph && ph.trim()) return ph.trim();
      }
      const alt = el.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();
      if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) {
        return el.value;
      }
      const txt = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (txt) return txt.slice(0, 80);
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
      if (tag === 'iframe') return 'iframe';
      return '';
    }
    function isInteractive(el: Element): boolean {
      if (roleOf(el)) return true;
      if (el.hasAttribute('onclick')) return true;
      const ti = el.getAttribute('tabindex');
      if (ti !== null && parseInt(ti, 10) >= 0) return true;
      return false;
    }
    function describe(el: Element): string {
      const role = roleOf(el) || el.tagName.toLowerCase();
      const name = accName(el);
      const r = el.getBoundingClientRect();
      const c = center(r);
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
        const opts = Array.from(el.options)
          .slice(0, 12)
          .map((o) => o.text.replace(/\s+/g, ' ').trim().slice(0, 25));
        bits.push(`options=[${opts.join(' | ')}${el.options.length > 12 ? ' | …' : ''}]`);
      }
      if ((el as HTMLInputElement).disabled) bits.push('disabled');
      if (el instanceof HTMLAnchorElement && el.href) bits.push('href=' + el.href.slice(0, 80));
      const exp = el.getAttribute('aria-expanded');
      if (exp) bits.push('expanded=' + exp);
      if (!inViewport(r)) bits.push('offscreen');
      return `[${refFor(el)}] ${role}${name ? ' "' + name + '"' : ''}${
        bits.length ? ' (' + bits.join(', ') + ')' : ''
      } @(${c.x},${c.y})`;
    }

    // ---------------- 收集 ----------------
    function collectInteractive(): Element[] {
      const out: Element[] = [];
      const added = new Set<Element>();
      const root = doc.body ?? doc.documentElement;
      if (!root) return out;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      let cursorChecked = 0;
      while (node && out.length < 600) {
        const el = node as Element;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') {
          node = walker.nextNode();
          continue;
        }
        let ok = isInteractive(el);
        // 启发式：cursor:pointer 的“伪按钮” div/span（限制数量，避免大页面卡顿）
        if (!ok && cursorChecked < 1500 && (tag === 'DIV' || tag === 'SPAN' || tag === 'LI' || tag === 'IMG' || tag === 'SVG')) {
          cursorChecked++;
          try {
            if (win.getComputedStyle(el).cursor === 'pointer' && !el.closest('a,button,[role]')) {
              const p = el.parentElement;
              ok = !p || win.getComputedStyle(p).cursor !== 'pointer';
            }
          } catch {
            /* ignore */
          }
        }
        if (ok && isVisible(el)) {
          let dup = false;
          let p = el.parentElement;
          while (p) {
            if (added.has(p)) {
              if (accName(p) === accName(el)) dup = true;
              break;
            }
            p = p.parentElement;
          }
          if (!dup) {
            out.push(el);
            added.add(el);
          }
        }
        node = walker.nextNode();
      }
      return out;
    }
    function headingOutline(maxLines: number): string {
      const lines: string[] = [];
      const hs = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
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
      const els = collectInteractive();
      const scrollMax = Math.max(0, (doc.documentElement.scrollHeight || 0) - win.innerHeight);
      const header =
        `URL: ${location.href}\nTitle: ${doc.title}\n` +
        `Viewport: ${win.innerWidth}x${win.innerHeight} css px | scrollY ${Math.round(win.scrollY)}/${Math.round(
          scrollMax,
        )}${scrollMax > 0 && win.scrollY < scrollMax ? ' (more content below — scroll to see it)' : ''}`;
      let body = '';
      if (filter !== 'interactive') {
        const outline = headingOutline(40);
        if (outline) body += `\n\n== Outline ==\n${outline}`;
      }
      body += `\n\n== Interactive elements (${els.length}${els.length >= 600 ? ', capped' : ''}) ==\n`;
      body += els.map(describe).join('\n');
      let text = header + body;
      if (text.length > maxChars) {
        text = text.slice(0, maxChars) + '\n…(truncated — use `find` with a query to locate specific elements)';
      }
      return { text };
    }
    function findEls(query: string): any {
      const q = String(query ?? '').toLowerCase().trim();
      if (!q) throw new Error('find: query is required');
      const tokens = q.split(/\s+/).filter(Boolean);
      const scored = collectInteractive()
        .map((el) => {
          const hay = (
            accName(el) + ' ' + roleOf(el) + ' ' + (el.getAttribute('id') ?? '') + ' ' +
            ((el as HTMLAnchorElement).href ?? '') + ' ' + (el.getAttribute('name') ?? '')
          ).toLowerCase();
          let score = 0;
          if (hay.includes(q)) score += 3;
          const hits = tokens.filter((t) => hay.includes(t)).length;
          if (tokens.length) score += (2 * hits) / tokens.length;
          return { el, score };
        })
        .filter((x) => x.score >= 1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
      if (!scored.length) {
        return { text: `No interactive elements matched "${query}". Call read_page to list everything, or the element may be in an iframe/not yet rendered.` };
      }
      return { text: `Matches for "${query}":\n` + scored.map((x) => describe(x.el)).join('\n') };
    }
    function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else (el as any).value = value;
    }
    function formInput(ref: unknown, value: unknown): any {
      const el = getRef(ref);
      (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
      const v = String(value ?? '');
      if (el instanceof HTMLSelectElement) {
        const opts = Array.from(el.options);
        const opt =
          opts.find((o) => o.value === v) ??
          opts.find((o) => o.text.trim() === v.trim()) ??
          opts.find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
        if (!opt) {
          throw new Error(
            `No option matches "${v}". Available: ${opts.slice(0, 20).map((o) => o.text.trim()).join(' | ')}`,
          );
        }
        el.value = opt.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { text: `Selected "${opt.text.trim()}" in ${describe(el)}` };
      }
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const want = ['true', '1', 'on', 'yes', 'checked'].includes(v.toLowerCase());
        if (el.type === 'radio') {
          if (!el.checked) el.click();
        } else if (el.checked !== want) {
          el.click();
        }
        return { text: `${describe(el)}` };
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        setNativeValue(el, v);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { text: `Set value (${v.length} chars) on ${describe(el)}` };
      }
      if ((el as HTMLElement).isContentEditable) {
        (el as HTMLElement).focus();
        el.textContent = v;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        return { text: `Set text on contenteditable ${describe(el)}` };
      }
      throw new Error(`ref is a <${el.tagName.toLowerCase()}>, not an editable form element`);
    }
    function elementInfo(ref: unknown): any {
      const el = getRef(ref);
      const r = el.getBoundingClientRect();
      const c = center(r);
      return {
        x: c.x,
        y: c.y,
        inViewport: inViewport(r),
        visible: isVisible(el),
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
        isFileInput: el instanceof HTMLInputElement && el.type === 'file',
        disabled: !!(el as HTMLInputElement).disabled,
        desc: describe(el),
      };
    }
    function scrollToRef(ref: unknown): any {
      const el = getRef(ref);
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
      const c = center(el.getBoundingClientRect());
      return { text: `Scrolled to ${describe(el)}`, x: c.x, y: c.y };
    }
    function focusRef(ref: unknown): any {
      const el = getRef(ref) as HTMLElement;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior });
      el.focus();
      const c = center(el.getBoundingClientRect());
      return {
        x: c.x,
        y: c.y,
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
      };
    }
    function activeInfo(): any {
      const el = doc.activeElement as HTMLElement | null;
      if (!el || el === doc.body) return { focused: false, isPassword: false };
      return {
        focused: true,
        tag: el.tagName.toLowerCase(),
        isPassword: el instanceof HTMLInputElement && el.type === 'password',
        editable:
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable,
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
        const c = center(el.getBoundingClientRect());
        for (const type of ['dragenter', 'dragover', 'drop']) {
          el.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: c.x, clientY: c.y }),
          );
        }
        return { text: `Dispatched drag-and-drop of "${file.name}" (${file.size} bytes) onto ${describe(el)}` };
      }
      let input: HTMLInputElement | null = null;
      if (el instanceof HTMLInputElement && el.type === 'file') input = el;
      else input = el.querySelector('input[type=file]');
      if (!input) {
        throw new Error('Target is not a file input and contains none. Try mode:"drop" on the dropzone element.');
      }
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { text: `Attached file "${file.name}" (${file.size} bytes) to ${describe(input)}` };
    }

    switch (cmd) {
      case 'read_page':
        return readPage(String(payload?.filter ?? 'interactive'), Number(payload?.max_chars ?? 16000));
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
