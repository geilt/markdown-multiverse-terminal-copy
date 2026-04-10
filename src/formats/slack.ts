import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { wrap, fence } from './wrap';

export function toSlack(segments: Segment[], kind: ContentKind): string {
  if (kind === 'code' || kind === 'diff' || kind === 'table') {
    return fence(toPlainText(segments));
  }
  return segments.map(renderSegment).join('');
}

function renderSegment(s: Segment): string {
  let text = s.text;
  if (s.style.code) {
    text = wrap(text, '`', '`');
  } else {
    if (s.style.bold) text = wrap(text, '*', '*');
    if (s.style.italic) text = wrap(text, '_', '_');
    if (s.style.strike) text = wrap(text, '~', '~');
  }
  if (s.style.href) {
    const label = text.replace(/>/g, '&gt;');
    text = `<${s.style.href}|${label}>`;
  }
  return text;
}
