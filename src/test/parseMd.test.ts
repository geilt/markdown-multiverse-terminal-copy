import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, parseInline } from '../parseMd';

test('parseInline: plain text', () => {
  const segs = parseInline('hello world');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, 'hello world');
});

test('parseInline: bold **text**', () => {
  const segs = parseInline('pre **bold** post');
  const bold = segs.find((s) => s.style.bold);
  assert.ok(bold);
  assert.equal(bold!.text, 'bold');
});

test('parseInline: italic *text*', () => {
  const segs = parseInline('pre *italic* post');
  const italic = segs.find((s) => s.style.italic);
  assert.ok(italic);
  assert.equal(italic!.text, 'italic');
});

test('parseInline: inline code `text`', () => {
  const segs = parseInline('run `npm install` now');
  const code = segs.find((s) => s.style.code);
  assert.ok(code);
  assert.equal(code!.text, 'npm install');
});

test('parseInline: link [text](url)', () => {
  const segs = parseInline('visit [example](https://example.com) now');
  const link = segs.find((s) => s.style.href);
  assert.ok(link);
  assert.equal(link!.text, 'example');
  assert.equal(link!.style.href, 'https://example.com');
});

test('parseInline: strikethrough ~~text~~', () => {
  const segs = parseInline('~~deleted~~');
  assert.equal(segs[0].style.strike, true);
  assert.equal(segs[0].text, 'deleted');
});

test('parseInline: nested bold + italic', () => {
  const segs = parseInline('**bold and *italic* inside**');
  const boldItalic = segs.find((s) => s.style.bold && s.style.italic);
  assert.ok(boldItalic);
});

test('parseInline: underscore bold __text__', () => {
  const segs = parseInline('__bold__');
  assert.equal(segs[0].style.bold, true);
});

test('parseInline: code span inside bold stays as code', () => {
  const segs = parseInline('**run `cmd` now**');
  const code = segs.find((s) => s.style.code);
  assert.ok(code);
  assert.equal(code!.text, 'cmd');
});

test('parseMarkdown: single paragraph', () => {
  const blocks = parseMarkdown('Hello world.');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
});

test('parseMarkdown: heading levels', () => {
  const blocks = parseMarkdown('# h1\n## h2\n### h3');
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'heading');
  assert.equal((blocks[0] as any).level, 1);
  assert.equal((blocks[1] as any).level, 2);
  assert.equal((blocks[2] as any).level, 3);
});

test('parseMarkdown: fenced code block', () => {
  const md = '```js\nconst x = 1;\nconst y = 2;\n```';
  const blocks = parseMarkdown(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'code');
  assert.equal((blocks[0] as any).lang, 'js');
  assert.equal((blocks[0] as any).text, 'const x = 1;\nconst y = 2;');
});

test('parseMarkdown: blockquote', () => {
  const blocks = parseMarkdown('> quoted text\n> continues');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'blockquote');
});

test('parseMarkdown: unordered list', () => {
  const blocks = parseMarkdown('- one\n- two\n- three');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'list');
  assert.equal((blocks[0] as any).ordered, false);
  assert.equal((blocks[0] as any).items.length, 3);
});

test('parseMarkdown: ordered list', () => {
  const blocks = parseMarkdown('1. one\n2. two');
  assert.equal(blocks.length, 1);
  assert.equal((blocks[0] as any).ordered, true);
});

test('parseMarkdown: hr', () => {
  const blocks = parseMarkdown('---');
  assert.equal(blocks[0].type, 'hr');
});

test('parseMarkdown: pipe table', () => {
  const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
  const blocks = parseMarkdown(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'table');
  assert.equal((blocks[0] as any).rows.length, 2);
});

test('parseMarkdown: mixed document', () => {
  const md = '# Title\n\nParagraph with **bold**.\n\n- item 1\n- item 2\n\n```\ncode\n```';
  const blocks = parseMarkdown(md);
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[2].type, 'list');
  assert.equal(blocks[3].type, 'code');
});
