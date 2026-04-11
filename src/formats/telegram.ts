import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { MdBlock } from '../parseMd';
import { wrap } from './wrap';

const TG_RESERVED = /[_*\[\]()~`>#+\-=|{}.!]/g;

export function toTelegram(segments: Segment[], kind: ContentKind): string {
  if (kind === 'code' || kind === 'diff' || kind === 'table') {
    const body = toPlainText(segments).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    return '```\n' + body + '\n```';
  }
  return segments.map(renderSegment).join('');
}

export function mdToTelegram(blocks: MdBlock[]): string {
  return blocks.map(renderBlock).join('\n\n').trimEnd();
}

function renderBlock(block: MdBlock): string {
  switch (block.type) {
    case 'heading':
      return '*' + block.segments.map(renderSegment).join('') + '*';
    case 'paragraph':
      return block.segments.map(renderSegment).join('');
    case 'code':
      return '```\n' + escapeTgCode(block.text) + '\n```';
    case 'blockquote':
      return block.blocks
        .map(renderBlock)
        .join('\n\n')
        .split('\n')
        .map((l) => '>' + l)
        .join('\n');
    case 'list':
      return block.items
        .map((item, idx) => {
          const marker = block.ordered ? escapeTgText(`${idx + 1}.`) + ' ' : '• ';
          const body = item.map(renderBlock).join('\n');
          return marker + body;
        })
        .join('\n');
    case 'hr':
      return escapeTgText('---');
    case 'table': {
      const plainHeader = block.header.map((seg) => toPlainText(seg)).join(' | ');
      const plainRows = block.rows.map((r) => r.map((seg) => toPlainText(seg)).join(' | '));
      return '```\n' + [plainHeader, ...plainRows].join('\n') + '\n```';
    }
  }
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
