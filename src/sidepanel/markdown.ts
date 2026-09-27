import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre class="code-block-wrap"><button type="button" class="code-copy-btn" title="复制代码">📋</button><code${langClass}>${escaped}</code></pre>`;
    },
  },
});

export function renderMarkdown(src: string): string {
  const html = marked.parse(src ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel', 'class', 'type', 'title'] });
}
