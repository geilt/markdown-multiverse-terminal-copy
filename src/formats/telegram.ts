import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { wrap } from './wrap';

const TG_RESERVED = /[_*\[\]()~`>#+\-=|{}.!]/g;

export function toTelegram(segments: Segment[], kind: ContentKind): string {
  if (kind === 'code' || kind === 'diff' || kind === 'table') {
    const body = toPlainText(segments).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    return '```\n' + body + '\n```';
  }
  return segments.map(renderSegment).join('');
}

function escapeTgText(s: string): string {
  return s.replace(TG_RESERVED, '\\$&');
}

function escapeTgCode(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

function escapeTgUrl(s: string): string {
  return s.replace(/[)\\]/g, '\\$&');
}

function renderSegment(s: Segment): string {
  let text: string;
  if (s.style.code) {
    text = '`' + escapeTgCode(s.text) + '`';
  } else {
    text = escapeTgText(s.text);
    if (s.style.underline) {
      text = wrap(text, '__', '__');
    } else if (s.style.italic) {
      text = wrap(text, '_', '_');
    }
    if (s.style.bold) text = wrap(text, '*', '*');
    if (s.style.strike) text = wrap(text, '~', '~');
  }
  if (s.style.href) {
    text = `[${text}](${escapeTgUrl(s.style.href)})`;
  }
  return text;
}
