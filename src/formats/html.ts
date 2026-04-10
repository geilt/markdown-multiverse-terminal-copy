import { detect } from '../detect';

export function toHtml(cleaned: string): string {
  const { kind } = detect(cleaned);
  if (kind === 'table') {
    return pipeTableToHtml(cleaned);
  }
  if (kind === 'prose') {
    const paragraphs = cleaned.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`);
    return paragraphs.join('\n');
  }
  return `<pre><code>${escapeHtml(cleaned)}</code></pre>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
