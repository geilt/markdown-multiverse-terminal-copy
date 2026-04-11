import { Segment, Style } from './rich';

export type MdBlock =
  | { type: 'heading'; level: number; segments: Segment[] }
  | { type: 'paragraph'; segments: Segment[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; blocks: MdBlock[] }
  | { type: 'list'; ordered: boolean; items: MdBlock[][] }
  | { type: 'hr' }
  | { type: 'table'; header: Segment[][]; rows: Segment[][][] };

export function parseMarkdown(text: string): MdBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return parseBlocks(lines);
}

function parseBlocks(lines: string[]): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(/^(\s*)(`{3,}|~{3,})\s*(\S*)\s*$/);
    if (fence) {
      const delim = fence[2];
      const lang = fence[3];
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${delim[0]}{${delim.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        segments: parseInline(heading[2])
      });
      i++;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', blocks: parseBlocks(quoteLines) });
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(line).map(parseInline);
      i += 2;
      const rows: Segment[][][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitTableRow(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) {
      const result = parseList(lines, i);
      blocks.push(result.list);
      i = result.next;
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', segments: parseInline(paraLines.join(' ')) });
  }
  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    /^(?:#{1,6})\s/.test(line) ||
    /^(?:\s*>)/.test(line) ||
    /^(?:```|~~~)/.test(line) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s*(?:[-*+]|\d+\.)\s/.test(line)
  );
}

function parseList(lines: string[], start: number): { list: MdBlock; next: number } {
  const firstMatch = lines[start].match(/^(\s*)([-*+]|\d+\.)\s(.*)$/)!;
  const indent = firstMatch[1].length;
  const ordered = /\d/.test(firstMatch[2]);
  const items: MdBlock[][] = [];
  let i = start;
  const markerPattern = new RegExp(`^\\s{${indent}}(?:[-*+]|\\d+\\.)\\s(.*)$`);

  while (i < lines.length) {
    const m = lines[i].match(markerPattern);
    if (!m) break;

    const itemLines: string[] = [m[1]];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === '') {
        break;
      }
      if (markerPattern.test(next)) break;
      if (isBlockStart(next.slice(indent))) break;
      itemLines.push(next.trim());
      i++;
    }
    items.push([{ type: 'paragraph', segments: parseInline(itemLines.join(' ')) }]);
  }
  return { list: { type: 'list', ordered, items }, next: i };
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function parseInline(text: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  const flush = () => {
    if (buf) {
      out.push({ text: buf, style: {} });
      buf = '';
    }
  };
  const pushWithStyle = (segments: Segment[], extra: Partial<Style>) => {
    for (const s of segments) {
      out.push({ text: s.text, style: { ...s.style, ...extra } });
    }
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];

    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ text: text.slice(i + 1, end), style: { code: true } });
        i = end + 1;
        continue;
      }
    }

    if (c === '!' && text[i + 1] === '[') {
      const close = findLinkEnd(text, i + 1);
      if (close) {
        flush();
        out.push({ text: text.slice(i + 2, close.labelEnd), style: {} });
        i = close.end;
        continue;
      }
    }

    if (c === '[') {
      const close = findLinkEnd(text, i);
      if (close) {
        flush();
        const inner = parseInline(text.slice(i + 1, close.labelEnd));
        pushWithStyle(inner, { href: close.url });
        i = close.end;
        continue;
      }
    }

    if (c === '*' && text[i + 1] === '*') {
      const end = findDelim(text, i + 2, '**');
      if (end > i) {
        flush();
        const inner = parseInline(text.slice(i + 2, end));
        pushWithStyle(inner, { bold: true });
        i = end + 2;
        continue;
      }
    }

    if (c === '_' && text[i + 1] === '_') {
      const end = findDelim(text, i + 2, '__');
      if (end > i) {
        flush();
        const inner = parseInline(text.slice(i + 2, end));
        pushWithStyle(inner, { bold: true });
        i = end + 2;
        continue;
      }
    }

    if (c === '~' && text[i + 1] === '~') {
      const end = findDelim(text, i + 2, '~~');
      if (end > i) {
        flush();
        const inner = parseInline(text.slice(i + 2, end));
        pushWithStyle(inner, { strike: true });
        i = end + 2;
        continue;
      }
    }

    if (c === '*' && text[i + 1] !== '*' && text[i - 1] !== '*') {
      const end = findSingleDelim(text, i + 1, '*');
      if (end > i) {
        flush();
        const inner = parseInline(text.slice(i + 1, end));
        pushWithStyle(inner, { italic: true });
        i = end + 1;
        continue;
      }
    }

    if (c === '_' && text[i + 1] !== '_' && text[i - 1] !== '_' && !/\w/.test(text[i - 1] ?? '')) {
      const end = findSingleDelim(text, i + 1, '_');
      if (end > i && !/\w/.test(text[end + 1] ?? '')) {
        flush();
        const inner = parseInline(text.slice(i + 1, end));
        pushWithStyle(inner, { italic: true });
        i = end + 1;
        continue;
      }
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

function findDelim(text: string, from: number, delim: string): number {
  let i = from;
  while (i < text.length - 1) {
    if (text[i] === '`') {
      const codeEnd = text.indexOf('`', i + 1);
      if (codeEnd > i) {
        i = codeEnd + 1;
        continue;
      }
    }
    if (text.slice(i, i + delim.length) === delim) return i;
    i++;
  }
  return -1;
}

function findSingleDelim(text: string, from: number, delim: string): number {
  let i = from;
  while (i < text.length) {
    if (text[i] === '`') {
      const codeEnd = text.indexOf('`', i + 1);
      if (codeEnd > i) {
        i = codeEnd + 1;
        continue;
      }
    }
    if (text[i] === delim && text[i + 1] !== delim && text[i - 1] !== delim) return i;
    i++;
  }
  return -1;
}

function findLinkEnd(text: string, start: number): { labelEnd: number; url: string; end: number } | null {
  let depth = 0;
  let i = start;
  let labelEnd = -1;
  while (i < text.length) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) {
        labelEnd = i;
        break;
      }
    } else if (text[i] === '`') {
      const codeEnd = text.indexOf('`', i + 1);
      if (codeEnd > i) {
        i = codeEnd;
      }
    }
    i++;
  }
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') return null;

  let parenDepth = 1;
  let j = labelEnd + 2;
  while (j < text.length && parenDepth > 0) {
    if (text[j] === '(') parenDepth++;
    else if (text[j] === ')') parenDepth--;
    if (parenDepth === 0) break;
    j++;
  }
  if (parenDepth !== 0) return null;
  return { labelEnd, url: text.slice(labelEnd + 2, j), end: j + 1 };
}
