import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTheme, THEMES } from '../js/theme.js';

test('THEMES: 시스템 · 라이트 · 다크 순서', () => {
  assert.deepEqual(THEMES.map((t) => t.id), ['system', 'light', 'dark']);
});

test('parseTheme: 저장된 라이트·다크는 그대로', () => {
  assert.equal(parseTheme('light'), 'light');
  assert.equal(parseTheme('dark'), 'dark');
});

test('parseTheme: 없거나 모르는 값은 시스템', () => {
  for (const v of [null, undefined, '', 'system', 'blue']) assert.equal(parseTheme(v), 'system', String(v));
});
