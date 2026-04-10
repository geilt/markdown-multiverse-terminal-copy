export function toTelegram(cleaned: string): string {
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/```/g, '\\`\\`\\`');
  return '```\n' + escaped + '\n```';
}
