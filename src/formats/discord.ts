import { detect } from '../detect';

export function toDiscord(cleaned: string): string {
  const { kind } = detect(cleaned);
  const langHint = kind === 'diff' ? 'diff' : '';
  const needsLongerFence = /```/.test(cleaned);
  const delim = needsLongerFence ? '````' : '```';
  return `${delim}${langHint}\n${cleaned}\n${delim}`;
}
