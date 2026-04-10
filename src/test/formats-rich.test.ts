import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Segment } from '../rich';
import { toMarkdown } from '../formats/markdown';
import { toSlack } from '../formats/slack';
import { toDiscord } from '../formats/discord';
import { toTelegram } from '../formats/telegram';
import { toHtml } from '../formats/html';

const boldProse: Segment[] = [
  { text: 'Here is ', style: {} },
  { text: 'bold', style: { bold: true } },
  { text: ' text.', style: {} }
];

const italicProse: Segment[] = [
  { text: 'An ', style: {} },
  { text: 'italic', style: { italic: true } },
  { text: ' word.', style: {} }
];

const linkProse: Segment[] = [
  { text: 'Visit ', style: {} },
  { text: 'example', style: { href: 'https://example.com' } },
  { text: ' for more.', style: {} }
];

const boldLinkProse: Segment[] = [
  { text: 'Click ', style: {} },
  { text: 'here', style: { bold: true, href: 'https://a.test' } },
  { text: '.', style: {} }
];

const codeSpanProse: Segment[] = [
  { text: 'Run ', style: {} },
  { text: 'npm install', style: { code: true } },
  { text: ' first.', style: {} }
];

test('markdown rich: bold → **bold**', () => {
  assert.equal(toMarkdown(boldProse, 'prose'), 'Here is **bold** text.');
});

test('markdown rich: italic → *italic*', () => {
  assert.equal(toMarkdown(italicProse, 'prose'), 'An *italic* word.');
});

test('markdown rich: link → [text](url)', () => {
  assert.equal(toMarkdown(linkProse, 'prose'), 'Visit [example](https://example.com) for more.');
});

test('markdown rich: bold link → [**text**](url)', () => {
  assert.equal(toMarkdown(boldLinkProse, 'prose'), 'Click [**here**](https://a.test).');
});

test('markdown rich: inline code → `code`', () => {
  assert.equal(toMarkdown(codeSpanProse, 'prose'), 'Run `npm install` first.');
});

test('slack rich: bold → *bold*', () => {
  assert.equal(toSlack(boldProse, 'prose'), 'Here is *bold* text.');
});

test('slack rich: italic → _italic_', () => {
  assert.equal(toSlack(italicProse, 'prose'), 'An _italic_ word.');
});

test('slack rich: link → <url|label>', () => {
  assert.equal(toSlack(linkProse, 'prose'), 'Visit <https://example.com|example> for more.');
});

test('discord rich: bold → **bold**', () => {
  assert.equal(toDiscord(boldProse, 'prose'), 'Here is **bold** text.');
});

test('discord rich: link → [text](url)', () => {
  assert.equal(toDiscord(linkProse, 'prose'), 'Visit [example](https://example.com) for more.');
});

test('telegram rich: escapes reserved chars outside fences', () => {
  const segs: Segment[] = [{ text: 'hello. world!', style: {} }];
  const result = toTelegram(segs, 'prose');
  assert.match(result, /hello\\\./);
  assert.match(result, /world\\!/);
});

test('telegram rich: bold wraps with asterisks', () => {
  const result = toTelegram(boldProse, 'prose');
  assert.match(result, /\*bold\*/);
});

test('telegram rich: link preserves URL unescaped and escapes body', () => {
  const result = toTelegram(linkProse, 'prose');
  assert.match(result, /\[example\]\(https:\/\/example\.com\)/);
  assert.match(result, /for more\\\./);
});

test('html rich: bold → <strong>', () => {
  assert.equal(toHtml(boldProse, 'prose'), '<p>Here is <strong>bold</strong> text.</p>');
});

test('html rich: italic → <em>', () => {
  assert.equal(toHtml(italicProse, 'prose'), '<p>An <em>italic</em> word.</p>');
});

test('html rich: link → <a href>', () => {
  assert.equal(
    toHtml(linkProse, 'prose'),
    '<p>Visit <a href="https://example.com">example</a> for more.</p>'
  );
});

test('html rich: code span → <code>', () => {
  assert.equal(toHtml(codeSpanProse, 'prose'), '<p>Run <code>npm install</code> first.</p>');
});

test('html rich: nested styles render in order', () => {
  const segs: Segment[] = [{ text: 'x', style: { bold: true, italic: true } }];
  const result = toHtml(segs, 'prose');
  assert.match(result, /<em><strong>x<\/strong><\/em>/);
});
