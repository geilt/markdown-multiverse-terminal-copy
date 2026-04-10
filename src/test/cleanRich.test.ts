import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRich } from '../cleanRich';
import { toPlainText } from '../rich';

test('cleanRich: plain text passes through', () => {
  const segs = cleanRich('hello world');
  assert.equal(toPlainText(segs), 'hello world');
});

test('cleanRich: strips ANSI but preserves text', () => {
  const raw = '\u001b[31mred text\u001b[0m';
  const segs = cleanRich(raw);
  assert.equal(toPlainText(segs), 'red text');
});

test('cleanRich: preserves bold style through pipeline', () => {
  const raw = 'pre \u001b[1mbold\u001b[22m post';
  const segs = cleanRich(raw);
  const bold = segs.find((s) => s.style.bold);
  assert.ok(bold);
  assert.equal(bold!.text.trim(), 'bold');
});

test('cleanRich: preserves hyperlinks through pipeline', () => {
  const raw = 'see \u001b]8;;https://example.com\u0007here\u001b]8;;\u0007 end';
  const segs = cleanRich(raw);
  const link = segs.find((s) => s.style.href);
  assert.ok(link);
  assert.equal(link!.text, 'here');
  assert.equal(link!.style.href, 'https://example.com');
});

test('cleanRich: auto-links plain URLs', () => {
  const segs = cleanRich('Visit https://example.com for more.');
  const link = segs.find((s) => s.style.href === 'https://example.com');
  assert.ok(link);
});

test('cleanRich: strips quote markers with style preserved', () => {
  const raw = '\u258E\u001b[1mquoted\u001b[22m';
  const segs = cleanRich(raw);
  assert.equal(toPlainText(segs), 'quoted');
  const bold = segs.find((s) => s.style.bold);
  assert.ok(bold);
});

test('cleanRich: resolves carriage returns', () => {
  const segs = cleanRich('[####    ] 40%\r[########] 100%');
  assert.equal(toPlainText(segs), '[########] 100%');
});

test('cleanRich: resolves backspaces', () => {
  const segs = cleanRich('b\bbo\bol\bld\bd');
  assert.equal(toPlainText(segs), 'bold');
});

test('cleanRich: reflows wrapped prose', () => {
  const raw = 'This is a sentence that wraps\nacross two lines.';
  const segs = cleanRich(raw);
  assert.equal(toPlainText(segs), 'This is a sentence that wraps across two lines.');
});

test('cleanRich: converts box tables to pipe tables', () => {
  const raw = '\u250C\u2500\u2500\u2500\u2510\n\u2502 a \u2502\n\u2514\u2500\u2500\u2500\u2518';
  const segs = cleanRich(raw);
  const text = toPlainText(segs);
  assert.match(text, /\| a \|/);
});
