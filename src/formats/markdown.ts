import { detect } from '../detect';

export function toMarkdown(cleaned: string): string {
  const { kind } = detect(cleaned);
  if (kind === 'table' || kind === 'prose') {
    return cleaned;
  }
  return fence(cleaned);
}

function fence(text: string): string {
  const needsLongerFence = /```/.test(text);
  const delim = needsLongerFence ? '````' : '```';
  return `${delim}\n${text}\n${delim}`;
}
