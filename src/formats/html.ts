import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';

export function toHtml(segments: Segment[], kind: ContentKind): string {
  if (kind === 'table') {
    return pipeTableToHtml(toPlainText(segments));
  }
  if (kind === 'code' || kind === 'diff') {
    return `<pre><code>${escapeHtml(toPlainText(segments))}</code></pre>`;
  }
  const rendered = segments.map(renderSegment).join('');
  const paragraphs = rendered.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
  return paragraphs.join('\n');
}

function renderSegment(s: Segment): string {
  let text = escapeHtml(s.text);
  if (s.style.code) text = `<code>${text}</code>`;
  if (s.style.bold) text = `<strong>${text}</strong>`;
  if (s.style.italic) text = `<em>${text}</em>`;
  if (s.style.underline) text = `<u>${text}</u>`;
  if (s.style.strike) text = `<s>${text}</s>`;
  if (s.style.href) {
    text = `<a href="${escapeAttr(s.style.href)}">${text}</a>`;
  }
  return text;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function pipeTableToHtml(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const rows = lines
    .filter((l) => !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
    );
  if (rows.length === 0) return `<pre><code>${escapeHtml(text)}</code></pre>`;

  const [header, ...body] = rows;
  const thead = `<thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const tbody = body.length
    ? `<tbody>${body
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
    : '';
  return `<table>${thead}${tbody}</table>`;
}
