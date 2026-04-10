import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnsi } from '../parse';
import { coalesce } from '../rich';

function parseSegs(raw: string) {
  return coalesce(parseAnsi(raw));
}

test('parse: plain text has no styles', () => {
  const segs = parseSegs('hello world');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, 'hello world');
  assert.deepEqual(segs[0].style, {});
});

test('parse: SGR bold on/off', () => {
  const segs = parseSegs('pre \u001b[1mbold\u001b[22m post');
  assert.equal(segs.length, 3);
  assert.equal(segs[0].text, 'pre ');
  assert.equal(segs[1].text, 'bold');
  assert.equal(segs[1].style.bold, true);
  assert.equal(segs[2].text, ' post');
  assert.equal(segs[2].style.bold, undefined);
});

test('parse: SGR italic', () => {
  const segs = parseSegs('\u001b[3memphasis\u001b[23m');
  const bold = segs.find((s) => s.style.italic);
  assert.ok(bold);
  assert.equal(bold!.text, 'emphasis');
});

test('parse: SGR reset clears all styles', () => {
  const segs = parseSegs('\u001b[1mbold\u001b[0m after');
  const after = segs.find((s) => s.text === ' after');
  assert.ok(after);
  assert.equal(after!.style.bold, undefined);
});

test('parse: OSC 8 hyperlink', () => {
  const raw = '\u001b]8;;https://example.com\u0007click here\u001b]8;;\u0007 done';
  const segs = parseSegs(raw);
  const link = segs.find((s) => s.style.href);
  assert.ok(link);
  assert.equal(link!.text, 'click here');
  assert.equal(link!.style.href, 'https://example.com');
});

test('parse: OSC 8 with ST terminator', () => {
  const raw = '\u001b]8;;https://a.test\u001b\\link\u001b]8;;\u001b\\';
  const segs = parseSegs(raw);
  const link = segs.find((s) => s.style.href);
  assert.ok(link);
  assert.equal(link!.style.href, 'https://a.test');
});

test('parse: nested bold + italic', () => {
  const raw = '\u001b[1mbold \u001b[3mboth\u001b[22m italic\u001b[23m';
  const segs = parseSegs(raw);
  const both = segs.find((s) => s.text === 'both');
  assert.ok(both);
  assert.equal(both!.style.bold, true);
  assert.equal(both!.style.italic, true);
});

test('parse: strips color codes', () => {
  const segs = parseSegs('\u001b[31mred\u001b[0m');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, 'red');
  assert.deepEqual(segs[0].style, {});
});

test('parse: strips 256-color extended fg', () => {
  const segs = parseSegs('\u001b[38;5;208morange\u001b[0m');
  assert.equal(segs[0].text, 'orange');
});

test('parse: strips truecolor fg', () => {
  const segs = parseSegs('\u001b[38;2;255;100;50mpeach\u001b[0m');
  assert.equal(segs[0].text, 'peach');
});

test('parse: strips cursor movement', () => {
  const segs = parseSegs('\u001b[2Aabove\u001b[10Cright');
  assert.equal(segs.map((s) => s.text).join(''), 'aboveright');
});

test('parse: strips OSC title', () => {
  const segs = parseSegs('\u001b]0;my title\u0007hello');
  assert.equal(segs.map((s) => s.text).join(''), 'hello');
});
