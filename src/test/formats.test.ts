import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPlain } from '../formats/plain';
import { toMarkdown } from '../formats/markdown';
import { toSlack } from '../formats/slack';
import { toTelegram } from '../formats/telegram';
import { toDiscord } from '../formats/discord';
import { toHtml } from '../formats/html';

const CODE = 'npm install\nadded 42 packages in 3s';
const TABLE = '| a | b |\n| --- | --- |\n| 1 | 2 |';
const PROSE = 'This is a paragraph. It has multiple sentences.\nAnd another sentence ends here.';
const DIFF = '@@ -1,3 +1,3 @@\n-old\n+new';

test('plain: passthrough', () => {
  assert.equal(toPlain(CODE), CODE);
});

test('markdown: code gets fenced', () => {
  assert.equal(toMarkdown(CODE), '```\n' + CODE + '\n```');
});

test('markdown: table passes through', () => {
  assert.equal(toMarkdown(TABLE), TABLE);
});

test('markdown: prose passes through', () => {
  assert.equal(toMarkdown(PROSE), PROSE);
});

test('markdown: longer fence when content contains triple-backticks', () => {
  const input = 'example:\n```\nfoo\n```';
  const result = toMarkdown(input);
  assert.match(result, /^````/);
  assert.match(result, /````$/);
});

test('slack: always fences', () => {
  assert.equal(toSlack(CODE), '```\n' + CODE + '\n```');
  assert.equal(toSlack(TABLE), '```\n' + TABLE + '\n```');
});

test('telegram: fences and escapes backticks + backslashes', () => {
  const input = 'has ``` inside\nand \\ backslash';
  const result = toTelegram(input);
  assert.match(result, /^```\n/);
  assert.match(result, /\\`\\`\\`/);
  assert.match(result, /\\\\/);
});

test('discord: diff gets diff language hint', () => {
  const result = toDiscord(DIFF);
  assert.match(result, /^```diff\n/);
});

test('discord: code uses plain fence', () => {
  const result = toDiscord(CODE);
  assert.match(result, /^```\n/);
});

test('html: code goes in pre/code with entity escaping', () => {
  const input = '<script>alert("x")</script>';
  const result = toHtml(input);
  assert.match(result, /<pre><code>/);
  assert.match(result, /&lt;script&gt;/);
  assert.match(result, /&quot;x&quot;/);
});

test('html: table converts to HTML table', () => {
  const result = toHtml(TABLE);
  assert.match(result, /<table>/);
  assert.match(result, /<thead>/);
  assert.match(result, /<th>a<\/th>/);
  assert.match(result, /<tbody>/);
  assert.match(result, /<td>1<\/td>/);
});

test('html: prose wraps in paragraph tags', () => {
  const result = toHtml(PROSE);
  assert.match(result, /<p>/);
  assert.match(result, /<\/p>/);
});

test('html: escapes ampersands and quotes', () => {
  const result = toHtml('a & b "quoted"');
  assert.match(result, /&amp;/);
  assert.match(result, /&quot;/);
});
