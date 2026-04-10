import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../detect';

test('detect: pipe table', () => {
  const input = '| a | b |\n| --- | --- |\n| 1 | 2 |';
  assert.equal(detect(input).kind, 'table');
});

test('detect: pipe table with leading whitespace', () => {
  const input = '  | name | age |\n  | --- | --- |\n  | alice | 30 |';
  assert.equal(detect(input).kind, 'table');
});

test('detect: not a table without separator', () => {
  const input = '| a | b |\n| 1 | 2 |';
  assert.notEqual(detect(input).kind, 'table');
});

test('detect: diff output', () => {
  const input = '@@ -1,3 +1,3 @@\n-old line\n+new line\n context';
  assert.equal(detect(input).kind, 'diff');
});

test('detect: prose paragraph', () => {
  const input = 'This is a sentence. Here is another one.\nAnd one more line ends.';
  assert.equal(detect(input).kind, 'prose');
});

test('detect: code / terminal output default', () => {
  const input = 'total 8\ndrwxr-xr-x 2 user user 64 Jan 1 file.txt\n-rw-r--r-- 1 user user 0 Jan 1 bar';
  assert.equal(detect(input).kind, 'code');
});

test('detect: empty input is prose', () => {
  assert.equal(detect('').kind, 'prose');
});

test('detect: single short line is code', () => {
  assert.equal(detect('npm install').kind, 'code');
});
