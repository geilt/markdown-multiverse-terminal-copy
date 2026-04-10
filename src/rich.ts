export interface Style {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

export interface StyledChar {
  ch: string;
  style: Style;
}

export interface Segment {
  text: string;
  style: Style;
}

export function styleEquals(a: Style, b: Style): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    a.href === b.href
  );
}

export function coalesce(chars: StyledChar[]): Segment[] {
  const out: Segment[] = [];
  for (const c of chars) {
    const last = out[out.length - 1];
    if (last && styleEquals(last.style, c.style)) {
      last.text += c.ch;
    } else {
      out.push({ text: c.ch, style: { ...c.style } });
    }
  }
  return out;
}

export function toPlainText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('');
}

export function splitLines(chars: StyledChar[]): StyledChar[][] {
  const lines: StyledChar[][] = [];
  let current: StyledChar[] = [];
  for (const c of chars) {
    current.push(c);
    if (c.ch === '\n') {
      lines.push(current);
      current = [];
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function lineText(line: StyledChar[]): string {
  return line.map((c) => c.ch).join('');
}
