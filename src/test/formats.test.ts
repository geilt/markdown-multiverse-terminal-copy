import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Segment } from '../rich';
import { toPlain } from '../formats/plain';
import { toMarkdown } from '../formats/markdown';
import { toSlack } from '../formats/slack';
import { toTelegram } from '../formats/telegram';
import { toDiscord } from '../formats/discord';
import { toHtml } from '../formats/html';

function plain(text: string): Segment[] {
  return [{ text, style: {} }];
}

const CODE = 'npm install\nadded 42 packages in 3s';
const TABLE = '| a | b |\n| --- | --- |\n| 1 | 2 |';
const DIFF = '@@ -1,3 +1,3 @@\n-old\n+new';

test('plain: passthrough', () => {
  assert.equal(toPlain(CODE), CODE);
});

test('markdown: code gets fenced', () => {
  assert.equal(toMarkdown(plain(CODE), 'code'), '```\n' + CODE + '\n```');
});

test('markdown: table passes through', () => {
  assert.equal(toMarkdown(plain(TABLE), 'table'), TABLE);
});

test('markdown: prose without styles passes through', () => {
  const prose = 'Hello world.';
  assert.equal(toMarkdown(plain(prose), 'prose'), prose);
});

test('markdown: longer fence when content contains triple-backticks', () => {
  const input = 'example:\n```\nfoo\n```';
  const result = toMarkdown(plain(input), 'code');
  assert.match(result, /^````/);
  assert.match(result, /````$/);
});

test('slack: fences code/table/diff', () => {
  assert.match(toSlack(plain(CODE), 'code'), /^```\n/);
  assert.match(toSlack(plain(TABLE), 'table'), /^```\n/);
});

test('telegram: fences code with escaped backticks and backslashes', () => {
  const input = 'has ``` inside\nand \\ backslash';
  const result = toTelegram(plain(input), 'code');
  assert.match(result, /^```\n/);
  assert.match(result, /\\`\\`\\`/);
  assert.match(result, /\\\\/);
});

test('discord: diff gets diff language hint', () => {
  const result = toDiscord(plain(DIFF), 'diff');
  assert.match(result, /^```diff\n/);
});

test('discord: code uses plain fence', () => {
  const result = toDiscord(plain(CODE), 'code');
  assert.match(result, /^```\n/);
});

test('html: code goes in pre/code with entity escaping', () => {
  const input = '<script>alert("x")</script>';
  const result = toHtml(plain(input), 'code');
  assert.match(result, /<pre><code>/);
  assert.match(result, /&lt;script&gt;/);
  assert.match(result, /&quot;x&quot;/);
});

test('html: table converts to HTML table', () => {
  const result = toHtml(plain(TABLE), 'table');
  assert.match(result, /<table>/);
  assert.match(result, /<thead>/);
  assert.match(result, /<th>a<\/th>/);
  assert.match(result, /<tbody>/);
  assert.match(result, /<td>1<\/td>/);
});

test('html: prose wraps in paragraph tags', () => {
  const input = 'First paragraph.\n\nSecond paragraph.';
  const result = toHtml(plain(input), 'prose');
  assert.match(result, /<p>First paragraph\.<\/p>/);
  assert.match(result, /<p>Second paragraph\.<\/p>/);
});

test('html: escapes ampersands and quotes', () => {
  const result = toHtml(plain('a & b "quoted"'), 'code');
  assert.match(result, /&amp;/);
  assert.match(result, /&quot;/);
});
