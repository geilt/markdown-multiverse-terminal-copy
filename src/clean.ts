export interface CleanOptions {
  stripPrompts?: boolean;
  tabWidth?: number;
}

const ANSI_PATTERN = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
  ].join('|'),
  'g'
);

const OSC_PATTERN = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;
const BRACKETED_PASTE = /\u001B\[\?(?:2004|1004|1000|1006)[hl]/g;

export function stripAnsi(input: string): string {
  return input.replace(OSC_PATTERN, '').replace(BRACKETED_PASTE, '').replace(ANSI_PATTERN, '');
}

export function resolveCarriageReturns(input: string): string {
  return input
    .split('\n')
    .map((line) => {
      if (!line.includes('\r')) return line;
      const parts = line.split('\r');
      let result = '';
      for (const part of parts) {
        if (part.length >= result.length) {
          result = part;
        } else {
          result = part + result.slice(part.length);
        }
      }
      return result;
    })
    .join('\n');
}

export function resolveBackspaces(input: string): string {
  const out: string[] = [];
  for (const ch of input) {
    if (ch === '\b') {
      if (out.length > 0) out.pop();
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

export function stripQuoteMarkers(input: string): string {
  return input.replace(/\u258E/g, '');
}

export function normalizeTabs(input: string, width = 4): string {
  return input.replace(/\t/g, ' '.repeat(width));
}

export function stripTrailingWhitespace(input: string): string {
  return input.replace(/[ \t]+$/gm, '');
}

export function dedentCommon(input: string): string {
  const lines = input.split('\n');
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  if (nonBlank.length === 0) return input;

  const indents = nonBlank.map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  const minIndent = Math.min(...indents);
  if (minIndent === 0) return input;

  const sharing = indents.filter((i) => i >= minIndent).length;
  if (sharing / nonBlank.length < 0.5) return input;

  return lines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l)).join('\n');
}

const BOX_CHARS = /[\u2500-\u257F]/;
const BOX_HORIZ_LINE = /^[\s\u2500-\u257F]+$/;

export function convertBoxTables(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BOX_CHARS.test(line) && line.includes('\u2502')) {
      const blockStart = i;
      const block: string[] = [];
      while (i < lines.length && (BOX_CHARS.test(lines[i]) || lines[i].trim() === '')) {
        block.push(lines[i]);
        i++;
      }
      const converted = tryConvertBoxBlock(block);
      if (converted) {
        out.push(...converted);
      } else {
        out.push(...block);
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
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

const DIFF_LINE = /^[+\-@]/;
const CODE_INDENT = /^ {4,}|^\t/;
const GUTTER_LINE = /^\s*\d+[\s:|\u2502]/;
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s/;
const HEADING_LINE = /^\s*#{1,6}\s/;

export function reflowParagraphs(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (
      line.trim() === '' ||
      DIFF_LINE.test(line) ||
      CODE_INDENT.test(line) ||
      GUTTER_LINE.test(line) ||
      LIST_LINE.test(line) ||
      HEADING_LINE.test(line) ||
      /[|\u2500-\u257F]/.test(line)
    ) {
      out.push(line);
      i++;
      continue;
    }

    let paragraph = line;
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        next.trim() === '' ||
        DIFF_LINE.test(next) ||
        CODE_INDENT.test(next) ||
        GUTTER_LINE.test(next) ||
        LIST_LINE.test(next) ||
        HEADING_LINE.test(next) ||
        /[|\u2500-\u257F]/.test(next)
      ) {
        break;
      }
      const endsWithHardBreak = /[.!?:]$/.test(paragraph.trimEnd());
      if (endsWithHardBreak && next.length > 0 && /^[A-Z]/.test(next)) {
        break;
      }
      paragraph = paragraph.trimEnd() + ' ' + next.trimStart();
      i++;
    }
    out.push(paragraph);
  }
  return out.join('\n');
}

const PROMPT_PATTERNS: RegExp[] = [
  /^[\w.-]+@[\w.-]+:[^$#]*[$#]\s?/,
  /^PS\s+[A-Z]:\\[^>]*>\s?/,
  /^>>>\s?/,
  /^\$\s/,
  /^#\s/
];

export function stripPrompts(input: string): string {
  return input
    .split('\n')
    .map((line) => {
      for (const p of PROMPT_PATTERNS) {
        const m = line.match(p);
        if (m) return line.slice(m[0].length);
      }
      return line;
    })
    .join('\n');
}

export function clean(raw: string, opts: CleanOptions = {}): string {
  const tabWidth = opts.tabWidth ?? 4;
  let text = raw;
  text = stripAnsi(text);
  text = resolveCarriageReturns(text);
  text = resolveBackspaces(text);
  text = stripQuoteMarkers(text);
  text = normalizeTabs(text, tabWidth);
  text = stripTrailingWhitespace(text);
  if (opts.stripPrompts) {
    text = stripPrompts(text);
  }
  text = dedentCommon(text);
  text = convertBoxTables(text);
  text = reflowParagraphs(text);
  return text.replace(/\n{3,}/g, '\n\n').trimEnd();
}
