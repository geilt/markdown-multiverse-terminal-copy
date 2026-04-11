import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { MdBlock } from '../parseMd';

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

export function mdToHtml(blocks: MdBlock[]): string {
  return blocks.map(renderBlock).join('\n');
}

function renderBlock(block: MdBlock): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.level}>${block.segments.map(renderSegment).join('')}</h${block.level}>`;
    case 'paragraph':
      return `<p>${block.segments.map(renderSegment).join('')}</p>`;
    case 'code': {
      const cls = block.lang ? ` class="language-${escapeAttr(block.lang)}"` : '';
      return `<pre><code${cls}>${escapeHtml(block.text)}</code></pre>`;
    }
    case 'blockquote':
      return `<blockquote>\n${block.blocks.map(renderBlock).join('\n')}\n</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items
        .map((item) => `  <li>${item.map(renderBlock).join('\n').replace(/^<p>(.*)<\/p>$/s, '$1')}</li>`)
        .join('\n');
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case 'hr':
      return '<hr>';
    case 'table': {
      const thead = `<thead><tr>${block.header
        .map((seg) => `<th>${seg.map(renderSegment).join('')}</th>`)
        .join('')}</tr></thead>`;
      const tbody = block.rows.length
        ? `<tbody>${block.rows
            .map(
              (row) =>
                `<tr>${row.map((seg) => `<td>${seg.map(renderSegment).join('')}</td>`).join('')}</tr>`
            )
            .join('')}</tbody>`
        : '';
      return `<table>${thead}${tbody}</table>`;
    }
  }
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
