import { Segment, toPlainText } from '../rich';
import { ContentKind } from '../detect';
import { MdBlock } from '../parseMd';
import { wrap, fence } from './wrap';

export function toSlack(segments: Segment[], kind: ContentKind): string {
  if (kind === 'code' || kind === 'diff' || kind === 'table') {
    return fence(toPlainText(segments));
  }
  return segments.map(renderSegment).join('');
}

export function mdToSlack(blocks: MdBlock[]): string {
  return blocks.map(renderBlock).join('\n\n').trimEnd();
}

function renderBlock(block: MdBlock): string {
  switch (block.type) {
    case 'heading':
      return '*' + block.segments.map(renderSegment).join('') + '*';
    case 'paragraph':
      return block.segments.map(renderSegment).join('');
    case 'code':
      return '```\n' + block.text + '\n```';
    case 'blockquote':
      return block.blocks
        .map(renderBlock)
        .join('\n\n')
        .split('\n')
        .map((l) => '> ' + l)
        .join('\n');
    case 'list':
      return block.items
        .map((item, idx) => {
          const marker = block.ordered ? `${idx + 1}. ` : '• ';
          const body = item.map(renderBlock).join('\n');
          return marker + body;
        })
        .join('\n');
    case 'hr':
      return '----';
    case 'table': {
      const headerLine = block.header.map((seg) => seg.map(renderSegment).join('')).join(' | ');
      const rowLines = block.rows.map((r) => r.map((seg) => seg.map(renderSegment).join('')).join(' | '));
      return '```\n' + [headerLine, ...rowLines].join('\n') + '\n```';
    }
  }
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
