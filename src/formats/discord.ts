import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { wrap, fence } from './wrap';

export function toDiscord(segments: Segment[], kind: ContentKind): string {
  if (kind === 'code' || kind === 'table') {
    return fence(toPlainText(segments));
  }
  if (kind === 'diff') {
    return fence(toPlainText(segments), 'diff');
  }
  return segments.map(renderSegment).join('');
}

function renderSegment(s: Segment): string {
  let text = s.text;
  if (s.style.code) {
    text = wrap(text, '`', '`');
  } else {
    if (s.style.bold) text = wrap(text, '**', '**');
    if (s.style.italic) text = wrap(text, '*', '*');
    if (s.style.underline) text = wrap(text, '__', '__');
    if (s.style.strike) text = wrap(text, '~~', '~~');
  }
  if (s.style.href) {
    text = `[${text}](${s.style.href})`;
  }
  return text;
}
