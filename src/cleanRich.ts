import { parseAnsi } from './parse';
import { Segment, Style, StyledChar, coalesce, lineText, splitLines } from './rich';
import { CleanOptions } from './clean';

const BOX_LINE = /[\u2500-\u257F]/;
const HAS_PIPE = /\u2502/;
const PROMPT_PATTERNS: RegExp[] = [
  /^[\w.-]+@[\w.-]+:[^$#]*[$#]\s?/,
  /^PS\s+[A-Z]:\\[^>]*>\s?/,
  /^>>>\s?/,
  /^\$\s/,
  /^#\s/
];
const DIFF_LINE = /^[+\-] /;
const DIFF_HUNK = /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/;
const GUTTER_LINE = /^\s*\d+[\s:|\u2502]/;
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s/;
const HEADING_LINE = /^\s*#{1,6}\s/;
const CODE_INDENT = /^ {4,}|^\t/;

export function cleanRich(raw: string, opts: CleanOptions = {}): Segment[] {
  const tabWidth = opts.tabWidth ?? 4;
  let chars = parseAnsi(raw);
  chars = resolveBackspaces(chars);
  chars = resolveCarriageReturns(chars);
  chars = stripQuoteMarkers(chars);
  chars = normalizeTabs(chars, tabWidth);
  chars = stripTrailingWhitespace(chars);
  if (opts.stripPrompts) chars = stripPrompts(chars);
  chars = dedentCommon(chars);
  chars = convertBoxTables(chars);
  chars = reflowParagraphs(chars);
  chars = autoLinkUrls(chars);
  chars = collapseBlankLines(chars);
  chars = trimTrailingNewlines(chars);
  return coalesce(chars);
}

function resolveBackspaces(chars: StyledChar[]): StyledChar[] {
  const out: StyledChar[] = [];
  for (const c of chars) {
    if (c.ch === '\b') {
      if (out.length > 0) out.pop();
    } else {
      out.push(c);
    }
  }
  return out;
}

function resolveCarriageReturns(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  const resolved = lines.map((line) => {
    const hasNewline = line.length > 0 && line[line.length - 1].ch === '\n';
    const body = hasNewline ? line.slice(0, -1) : line;
    if (!body.some((c) => c.ch === '\r')) return line;

    const parts: StyledChar[][] = [[]];
    for (const c of body) {
      if (c.ch === '\r') parts.push([]);
      else parts[parts.length - 1].push(c);
    }

    let result: StyledChar[] = [];
    for (const part of parts) {
      if (part.length >= result.length) {
        result = part;
      } else {
        result = [...part, ...result.slice(part.length)];
      }
    }
    return hasNewline ? [...result, line[line.length - 1]] : result;
  });
  return resolved.flat();
}

function stripQuoteMarkers(chars: StyledChar[]): StyledChar[] {
  return chars.filter((c) => c.ch !== '\u258E');
}

function normalizeTabs(chars: StyledChar[], width: number): StyledChar[] {
  const out: StyledChar[] = [];
  const spaces = ' '.repeat(width);
  for (const c of chars) {
    if (c.ch === '\t') {
      for (const s of spaces) out.push({ ch: s, style: c.style });
    } else {
      out.push(c);
    }
  }
  return out;
}

function stripTrailingWhitespace(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  return lines.flatMap((line) => {
    const hasNewline = line.length > 0 && line[line.length - 1].ch === '\n';
    let body = hasNewline ? line.slice(0, -1) : line;
    while (body.length > 0 && (body[body.length - 1].ch === ' ' || body[body.length - 1].ch === '\t')) {
      body = body.slice(0, -1);
    }
    return hasNewline ? [...body, line[line.length - 1]] : body;
  });
}

function stripPrompts(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  return lines.flatMap((line) => {
    const text = lineText(line);
    for (const p of PROMPT_PATTERNS) {
      const m = text.match(p);
      if (m) return line.slice(m[0].length);
    }
    return line;
  });
}

function dedentCommon(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  const nonBlank = lines.filter((l) => {
    const t = lineText(l);
    return t.replace(/\n$/, '').trim().length > 0;
  });
  if (nonBlank.length === 0) return chars;

  const indents = nonBlank.map((line) => {
    let i = 0;
    while (i < line.length && (line[i].ch === ' ' || line[i].ch === '\t')) i++;
    return i;
  });
  const minIndent = Math.min(...indents);
  if (minIndent === 0) return chars;

  const sharing = indents.filter((n) => n >= minIndent).length;
  if (sharing / nonBlank.length < 0.5) return chars;

  return lines.flatMap((line) => {
    const textLen = line.length - (line[line.length - 1]?.ch === '\n' ? 1 : 0);
    return textLen >= minIndent ? line.slice(minIndent) : line;
  });
}

function convertBoxTables(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  const out: StyledChar[][] = [];
  let i = 0;
  while (i < lines.length) {
    const text = lineText(lines[i]);
    if (BOX_LINE.test(text) && HAS_PIPE.test(text)) {
      const block: StyledChar[][] = [];
      while (i < lines.length) {
        const t = lineText(lines[i]);
        if (BOX_LINE.test(t) || t.replace(/\n$/, '').trim() === '') {
          block.push(lines[i]);
          i++;
        } else {
          break;
        }
      }
      const converted = tryConvertBoxBlock(block.map((l) => lineText(l).replace(/\n$/, '')));
      if (converted) {
        for (const convertedLine of converted) {
          const styled: StyledChar[] = [...convertedLine].map((ch) => ({ ch, style: {} }));
          styled.push({ ch: '\n', style: {} });
          out.push(styled);
        }
      } else {
        out.push(...block);
      }
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.flat();
}

function tryConvertBoxBlock(block: string[]): string[] | null {
  const rows = block.filter((l) => l.includes('\u2502'));
  if (rows.length < 1) return null;

  const parsed: string[][] = rows.map((r) =>
    r
      .split('\u2502')
      .slice(1, -1)
      .map((c) => c.trim())
  );

  const cols = parsed[0]?.length ?? 0;
  if (cols === 0) return null;
  if (!parsed.every((r) => r.length === cols)) return null;

  const md: string[] = [];
  md.push('| ' + parsed[0].join(' | ') + ' |');
  md.push('|' + ' --- |'.repeat(cols));
  for (let r = 1; r < parsed.length; r++) {
    md.push('| ' + parsed[r].join(' | ') + ' |');
  }
  return md;
}

function isStructuralLine(text: string): boolean {
  const t = text.replace(/\n$/, '');
  if (t.trim() === '') return true;
  if (DIFF_LINE.test(t) || DIFF_HUNK.test(t)) return true;
  if (CODE_INDENT.test(t)) return true;
  if (GUTTER_LINE.test(t)) return true;
  if (LIST_LINE.test(t)) return true;
  if (HEADING_LINE.test(t)) return true;
  if (/[|\u2500-\u257F]/.test(t)) return true;
  return false;
}

function reflowParagraphs(chars: StyledChar[]): StyledChar[] {
  const lines = splitLines(chars);
  const out: StyledChar[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const text = lineText(line);
    if (isStructuralLine(text)) {
      out.push(...line);
      i++;
      continue;
    }

    const hasNewline = line.length > 0 && line[line.length - 1].ch === '\n';
    let para: StyledChar[] = hasNewline ? line.slice(0, -1) : line.slice();
    i++;

    while (i < lines.length) {
      const next = lines[i];
      const nextText = lineText(next);
      if (isStructuralLine(nextText) || nextText.replace(/\n$/, '').trim() === '') break;

      const paraText = para.map((c) => c.ch).join('').trimEnd();
      const nextNoNewline = nextText.replace(/\n$/, '');
      if (/[.!?:]$/.test(paraText) && /^[A-Z]/.test(nextNoNewline.trimStart())) break;

      while (para.length > 0 && (para[para.length - 1].ch === ' ' || para[para.length - 1].ch === '\t')) {
        para.pop();
      }
      para.push({ ch: ' ', style: {} });

      const nextHasNewline = next.length > 0 && next[next.length - 1].ch === '\n';
      let nextBody = nextHasNewline ? next.slice(0, -1) : next.slice();
      while (nextBody.length > 0 && (nextBody[0].ch === ' ' || nextBody[0].ch === '\t')) {
        nextBody.shift();
      }
      para.push(...nextBody);
      i++;
    }

    if (hasNewline) para.push({ ch: '\n', style: {} });
    out.push(...para);
  }
  return out;
}

const URL_RE = /https?:\/\/[^\s<>"'`\])]+/g;

function autoLinkUrls(chars: StyledChar[]): StyledChar[] {
  const text = chars.map((c) => c.ch).join('');
  const matches: Array<[number, number, string]> = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    matches.push([m.index, m.index + m[0].length, m[0]]);
  }
  if (matches.length === 0) return chars;

  const out = chars.slice();
  for (const [start, end, url] of matches) {
    for (let i = start; i < end; i++) {
      if (!out[i].style.href) {
        out[i] = { ch: out[i].ch, style: { ...out[i].style, href: url } };
      }
    }
  }
  return out;
}

function collapseBlankLines(chars: StyledChar[]): StyledChar[] {
  const out: StyledChar[] = [];
  let consecutiveNewlines = 0;
  for (const c of chars) {
    if (c.ch === '\n') {
      consecutiveNewlines++;
      if (consecutiveNewlines <= 2) out.push(c);
    } else {
      consecutiveNewlines = 0;
      out.push(c);
    }
  }
  return out;
}

function trimTrailingNewlines(chars: StyledChar[]): StyledChar[] {
  let end = chars.length;
  while (end > 0) {
    const ch = chars[end - 1].ch;
    if (ch === '\n' || ch === ' ' || ch === '\t') end--;
    else break;
  }
  return chars.slice(0, end);
}
