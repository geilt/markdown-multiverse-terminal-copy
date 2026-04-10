import { Segment } from './rich';

export type ContentKind = 'table' | 'diff' | 'code' | 'prose';

export interface Detected {
  kind: ContentKind;
}

export function detectRich(segments: Segment[]): Detected {
  const plain = segments.map((s) => s.text).join('');
  const base = detect(plain).kind;

  if (base === 'table' || base === 'diff') return { kind: base };

  const hasStyle = segments.some(
    (s) => s.style.bold || s.style.italic || s.style.underline || s.style.strike || s.style.code || s.style.href
  );
  if (hasStyle) return { kind: 'prose' };
  return { kind: base };
}

const PIPE_ROW = /^\s*\|.*\|\s*$/;
const PIPE_SEPARATOR = /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;
const DIFF_HUNK = /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/;
const DIFF_LINE = /^[+\-] /;
const SENTENCE_LINE = /^[A-Z].*[.!?]\s*$/;

export function detect(text: string): Detected {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { kind: 'prose' };

  const pipeRows = lines.filter((l) => PIPE_ROW.test(l)).length;
  const hasSeparator = lines.some((l) => PIPE_SEPARATOR.test(l));
  if (hasSeparator && pipeRows >= 2 && pipeRows === lines.length) {
    return { kind: 'table' };
  }

  const hasHunk = lines.some((l) => DIFF_HUNK.test(l));
  const diffLines = lines.filter((l) => DIFF_LINE.test(l)).length;
  if (hasHunk || (diffLines >= 2 && diffLines / lines.length > 0.5)) {
    return { kind: 'diff' };
  }

  const sentenceLines = lines.filter((l) => SENTENCE_LINE.test(l.trim())).length;
  if (lines.length >= 2 && sentenceLines / lines.length > 0.5) {
    return { kind: 'prose' };
  }

  return { kind: 'code' };
}
