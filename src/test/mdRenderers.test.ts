import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../parseMd';
import { mdToSlack } from '../formats/slack';
import { mdToDiscord } from '../formats/discord';
import { mdToTelegram } from '../formats/telegram';
import { mdToHtml } from '../formats/html';

const MD_SIMPLE = '# Heading\n\nA paragraph with **bold** and *italic* and `code`.\n\n- first\n- second';

test('mdToSlack: heading becomes bold line', () => {
  const result = mdToSlack(parseMarkdown('# My heading'));
  assert.equal(result, '*My heading*');
});

test('mdToSlack: bold + italic + code', () => {
  const result = mdToSlack(parseMarkdown('plain **bold** *italic* `code`'));
  assert.match(result, /\*bold\*/);
  assert.match(result, /_italic_/);
  assert.match(result, /`code`/);
});

test('mdToSlack: link → <url|text>', () => {
  const result = mdToSlack(parseMarkdown('[example](https://a.test)'));
  assert.match(result, /<https:\/\/a\.test\|example>/);
});

test('mdToSlack: unordered list uses bullets', () => {
  const result = mdToSlack(parseMarkdown('- one\n- two'));
  assert.match(result, /• one/);
  assert.match(result, /• two/);
});

test('mdToSlack: code block fenced', () => {
  const result = mdToSlack(parseMarkdown('```\nhello\n```'));
  assert.match(result, /```\nhello\n```/);
});

test('mdToDiscord: heading becomes # heading', () => {
  const result = mdToDiscord(parseMarkdown('## sub heading'));
  assert.equal(result, '## sub heading');
});

test('mdToDiscord: bold + italic preserved', () => {
  const result = mdToDiscord(parseMarkdown('**bold** and *italic*'));
  assert.match(result, /\*\*bold\*\*/);
  assert.match(result, /\*italic\*/);
});

test('mdToDiscord: link preserved as markdown', () => {
  const result = mdToDiscord(parseMarkdown('[example](https://a.test)'));
  assert.match(result, /\[example\]\(https:\/\/a\.test\)/);
});

test('mdToDiscord: code block with language hint', () => {
  const result = mdToDiscord(parseMarkdown('```js\nconst x = 1;\n```'));
  assert.match(result, /```js\nconst x = 1;\n```/);
});

test('mdToTelegram: heading becomes bold', () => {
  const result = mdToTelegram(parseMarkdown('# Title'));
  assert.equal(result, '*Title*');
});

test('mdToTelegram: reserved chars escaped in prose', () => {
  const result = mdToTelegram(parseMarkdown('See more.'));
  assert.match(result, /See more\\\./);
});

test('mdToTelegram: bold + italic + code', () => {
  const result = mdToTelegram(parseMarkdown('plain **bold** *italic* `code`'));
  assert.match(result, /\*bold\*/);
  assert.match(result, /_italic_/);
  assert.match(result, /`code`/);
});

test('mdToTelegram: blockquote uses >', () => {
  const result = mdToTelegram(parseMarkdown('> quoted text'));
  assert.match(result, /^>/);
});

test('mdToHtml: heading → <h1>', () => {
  const result = mdToHtml(parseMarkdown('# Title'));
  assert.equal(result, '<h1>Title</h1>');
});

test('mdToHtml: paragraph → <p>', () => {
  const result = mdToHtml(parseMarkdown('hello world'));
  assert.equal(result, '<p>hello world</p>');
});

test('mdToHtml: bold + italic + code', () => {
  const result = mdToHtml(parseMarkdown('**bold** and *italic* and `code`'));
  assert.match(result, /<strong>bold<\/strong>/);
  assert.match(result, /<em>italic<\/em>/);
  assert.match(result, /<code>code<\/code>/);
});

test('mdToHtml: link → <a href>', () => {
  const result = mdToHtml(parseMarkdown('[example](https://a.test)'));
  assert.match(result, /<a href="https:\/\/a\.test">example<\/a>/);
});

test('mdToHtml: unordered list → <ul>', () => {
  const result = mdToHtml(parseMarkdown('- one\n- two'));
  assert.match(result, /<ul>/);
  assert.match(result, /<li>one<\/li>/);
  assert.match(result, /<li>two<\/li>/);
});

test('mdToHtml: code block with language class', () => {
  const result = mdToHtml(parseMarkdown('```js\nconst x = 1;\n```'));
  assert.match(result, /<pre><code class="language-js">const x = 1;<\/code><\/pre>/);
});

test('mdToHtml: blockquote → <blockquote>', () => {
  const result = mdToHtml(parseMarkdown('> quoted'));
  assert.match(result, /<blockquote>/);
});

test('mdToHtml: table → <table>', () => {
  const result = mdToHtml(parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |'));
  assert.match(result, /<table>/);
  assert.match(result, /<th>a<\/th>/);
  assert.match(result, /<td>1<\/td>/);
});

test('mdToHtml: hr', () => {
  const result = mdToHtml(parseMarkdown('---'));
  assert.equal(result, '<hr>');
});

test('mdToHtml: escapes HTML in text', () => {
  const result = mdToHtml(parseMarkdown('use <script> carefully'));
  assert.match(result, /&lt;script&gt;/);
});

test('all formats: round-trip mixed document', () => {
  const slack = mdToSlack(parseMarkdown(MD_SIMPLE));
  const discord = mdToDiscord(parseMarkdown(MD_SIMPLE));
  const telegram = mdToTelegram(parseMarkdown(MD_SIMPLE));
  const html = mdToHtml(parseMarkdown(MD_SIMPLE));

  assert.match(slack, /\*Heading\*/);
  assert.match(discord, /# Heading/);
  assert.match(telegram, /\*Heading\*/);
  assert.match(html, /<h1>Heading<\/h1>/);
});
