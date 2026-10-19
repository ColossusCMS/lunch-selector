import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/csv.js';

test('기본 행과 열', () => assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]));
test('따옴표 안 쉼표', () => assert.deepEqual(parseCsv('"분식,한식",x'), [['분식,한식', 'x']]));
test('이스케이프된 따옴표', () => assert.deepEqual(parseCsv('"짬뽕 ""맛집"""'), [['짬뽕 "맛집"']]));
test('따옴표 안 줄바꿈', () => assert.deepEqual(parseCsv('"a\nb",c'), [['a\nb', 'c']]));
test('CRLF와 마지막 줄바꿈', () => assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]));
test('빈 칸 유지', () => assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]));
test('빈 문자열', () => assert.deepEqual(parseCsv(''), []));
