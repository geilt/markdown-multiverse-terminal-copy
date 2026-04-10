import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clean,
  stripAnsi,
  resolveCarriageReturns,
  resolveBackspaces,
  stripQuoteMarkers,
  normalizeTabs,
  stripTrailingWhitespace,
  dedentCommon,
  convertBoxTables,
  reflowParagraphs,
  stripPrompts
} from '../clean';

test('stripAnsi removes SGR color codes', () => {
  const raw = '\u001b[31mred\u001b[0m \u001b[1;32mbold green\u001b[0m';
  assert.equal(stripAnsi(raw), 'red bold green');
});

test('stripAnsi removes cursor movement sequences', () => {
  const raw = 'hello\u001b[2Aworld\u001b[5;10H!';
  assert.equal(stripAnsi(raw), 'helloworld!');
});

test('stripAnsi removes OSC title sequences', () => {
  const raw = '\u001b]0;window title\u0007actual output';
  assert.equal(stripAnsi(raw), 'actual output');
});

test('resolveCarriageReturns keeps final overwrite state', () => {
  const raw = 'downloading...\rdone!         ';
  assert.equal(resolveCarriageReturns(raw), 'done!         ');
});

test('resolveCarriageReturns handles progress bar updates', () => {
  const raw = '[####    ] 40%\r[######  ] 60%\r[########] 100%';
  assert.equal(resolveCarriageReturns(raw), '[########] 100%');
});

test('resolveCarriageReturns preserves newlines between lines', () => {
  const raw = 'line1\nfoo\rbar\nline3';
  assert.equal(resolveCarriageReturns(raw), 'line1\nbar\nline3');
});

test('resolveBackspaces handles man-page bold overprinting', () => {
  const raw = 'b\bbo\bol\bld\bd';
  assert.equal(resolveBackspaces(raw), 'bold');
});

test('stripQuoteMarkers removes U+258E', () => {
  const raw = '\u258E quoted line';
  assert.equal(stripQuoteMarkers(raw), ' quoted line');
});

test('normalizeTabs replaces tabs with spaces', () => {
  assert.equal(normalizeTabs('a\tb\tc', 4), 'a    b    c');
  assert.equal(normalizeTabs('a\tb', 4), 'a    b');
  assert.equal(normalizeTabs('a\tb', 2), 'a  b');
});

test('stripTrailingWhitespace trims per-line', () => {
  assert.equal(stripTrailingWhitespace('a   \nb\t\nc'), 'a\nb\nc');
});

test('dedentCommon removes shared leading indent', () => {
  const raw = '    foo\n    bar\n    baz';
  assert.equal(dedentCommon(raw), 'foo\nbar\nbaz');
});

test('dedentCommon preserves structure when indents differ', () => {
  const raw = '    foo\n  bar\n      baz';
  assert.equal(dedentCommon(raw), '  foo\nbar\n    baz');
});

test('convertBoxTables produces Markdown pipe tables', () => {
  const raw = [
    '\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2510',
    '\u2502 a \u2502 b \u2502',
    '\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2524',
    '\u2502 1 \u2502 2 \u2502',
    '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2518'
  ].join('\n');
  const result = convertBoxTables(raw);
  assert.match(result, /\| a \| b \|/);
  assert.match(result, /\| --- \| --- \|/);
  assert.match(result, /\| 1 \| 2 \|/);
});

test('reflowParagraphs rejoins wrapped prose', () => {
  const raw = 'This is a long sentence that got\nwrapped across multiple\nlines by the terminal.';
  assert.equal(
    reflowParagraphs(raw),
    'This is a long sentence that got wrapped across multiple lines by the terminal.'
  );
});

test('reflowParagraphs preserves diff blocks', () => {
  const raw = '- removed line\n+ added line\n@@ hunk header';
  assert.equal(reflowParagraphs(raw), raw);
});

test('reflowParagraphs preserves gutter-numbered output', () => {
  const raw = '  1: first match\n  2: second match\n  3: third match';
  assert.equal(reflowParagraphs(raw), raw);
});

test('stripPrompts removes bash-style prompts', () => {
  const raw = 'user@host:~/project$ ls\nfile1 file2';
  assert.equal(stripPrompts(raw), 'ls\nfile1 file2');
});

test('stripPrompts removes Python REPL prompts', () => {
  assert.equal(stripPrompts('>>> 1 + 1\n2'), '1 + 1\n2');
});

test('clean composes the full pipeline on a realistic ls sample', () => {
  const raw =
    '\u001b[01;34msrc\u001b[0m  \u001b[01;34mdocs\u001b[0m  README.md\t   \n' +
    '\u001b[01;34mnode_modules\u001b[0m  package.json  ';
  const result = clean(raw);
  assert.doesNotMatch(result, /\u001b/);
  assert.doesNotMatch(result, /[ \t]+$/m);
  assert.match(result, /src/);
  assert.match(result, /README\.md/);
});

test('clean handles curl progress bar output', () => {
  const raw =
    '  % Total    % Received\r 10 10000    10  1000\r 50 10000    50  5000\r100 10000   100 10000';
  const result = clean(raw);
  assert.match(result, /100 10000/);
  assert.doesNotMatch(result, /50 10000/);
});

test('clean collapses excessive blank lines', () => {
  const raw = 'line1\n\n\n\n\nline2';
  assert.equal(clean(raw), 'line1\n\nline2');
});

test('clean returns empty string for empty input', () => {
  assert.equal(clean(''), '');
});

test('clean handles realistic claude terminal quote', () => {
  const raw = '\u258E user said hello\n\u258E claude replied';
  const result = clean(raw);
  assert.doesNotMatch(result, /\u258E/);
  assert.match(result, /user said hello/);
});
