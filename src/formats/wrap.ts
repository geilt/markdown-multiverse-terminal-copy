export function wrap(text: string, open: string, close: string): string {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || m[2] === '') return text;
  return m[1] + open + m[2] + close + m[3];
}

export function fence(text: string, hint = ''): string {
  const needsLonger = /```/.test(text);
  const delim = needsLonger ? '````' : '```';
  return `${delim}${hint}\n${text}\n${delim}`;
}
