import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadStores } from '../js/data.js';
import { buildDataUrl, buildEditUrl } from '../js/config.js';

const ok = (body) => async () => ({ ok: true, text: async () => body });

test('정상 CSV', async () => {
  const s = await loadStores('x', ok('가게명,그룹\n본죽,2팀'));
  assert.equal(s[0].name, '본죽');
});

test('HTTP 오류면 throw', async () =>
  assert.rejects(loadStores('x', async () => ({ ok: false, status: 404, text: async () => '' }))));

test('HTML 응답이면 throw', async () =>
  assert.rejects(loadStores('x', ok('<!DOCTYPE html><html>로그인</html>'))));

test('fetch 자체 실패면 throw', async () =>
  assert.rejects(loadStores('x', async () => { throw new TypeError('offline'); })));

test('예시 CSV 파일이 6개 가게로 읽힘', async () => {
  const text = await readFile(new URL('../data/sample-stores.csv', import.meta.url), 'utf8');
  const stores = await loadStores('x', ok(text));
  assert.equal(stores.length, 6);
  assert.deepEqual(stores[0].categories, ['분식', '한식']);
  assert.equal(stores[5].enabled, false);
});

test('buildDataUrl', () => {
  assert.equal(buildDataUrl({ sheetId: '', tab: '가게목록', override: '' }), 'data/sample-stores.csv');
  assert.equal(buildDataUrl({ sheetId: 'ID', tab: '가게목록', override: 'o.csv' }), 'o.csv');
  assert.equal(
    buildDataUrl({ sheetId: 'ID', tab: '가게목록', override: '' }),
    'https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv&headers=1&sheet=%EA%B0%80%EA%B2%8C%EB%AA%A9%EB%A1%9D',
  );
});

test('buildEditUrl', () => {
  assert.equal(buildEditUrl(''), null);
  assert.equal(buildEditUrl('ID'), 'https://docs.google.com/spreadsheets/d/ID/edit');
});
