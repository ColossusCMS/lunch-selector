import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadStores, createRequestCounter } from '../js/data.js';
import { buildDataUrl, buildEditUrl, availableModes, initialMode } from '../js/config.js';

const ok = (body) => async () => ({ ok: true, text: async () => body });

test('initialMode: 저장값 > 첫 모드 > null', () => {
  const list = [{ id: 'lunch' }, { id: 'cafe' }];
  assert.equal(initialMode(list, 'cafe'), list[1]);
  assert.equal(initialMode(list, 'gone'), list[0]);
  assert.equal(initialMode(list, null), list[0]);
  assert.equal(initialMode([], 'cafe'), null);
});

test('createRequestCounter: 마지막 번호만 최신', () => {
  const c = createRequestCounter();
  const a = c.next();
  assert.equal(c.isLatest(a), true);
  const b = c.next();
  assert.equal(c.isLatest(a), false);
  assert.equal(c.isLatest(b), true);
});

test('응답이 오지 않으면 제한 시간 뒤 throw', async () =>
  assert.rejects(loadStores('x', () => new Promise(() => {}), { timeout: 20 }), /시간 초과/));

test('본문이 오지 않아도 제한 시간 뒤 throw', async () =>
  assert.rejects(loadStores('x', async () => ({ ok: true, text: () => new Promise(() => {}) }), { timeout: 20 }), /시간 초과/));

test('fetch에 signal과 no-store를 넘긴다', async () => {
  let opts;
  await loadStores('x', async (_url, o) => { opts = o; return { ok: true, text: async () => '가게명,그룹\nA,G' }; });
  assert.equal(opts.cache, 'no-store');
  assert.ok(opts.signal instanceof AbortSignal);
});

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

const LUNCH = { id: 'lunch', tab: '가게목록', gid: '0' };
const CAFE = { id: 'cafe', tab: '카페목록', gid: '' };
const PUB = 'https://docs.google.com/spreadsheets/d/e/KEY/pub';

test('buildDataUrl: 게시 주소가 있으면 탭 번호로 게시 CSV를 읽는다', () => {
  assert.equal(
    buildDataUrl({ sheetId: 'ID', publishUrl: PUB, mode: { ...CAFE, gid: '123' } }),
    `${PUB}?gid=123&single=true&output=csv`,
  );
});

test('buildDataUrl: 게시 주소가 없으면 시트 ID와 탭 이름으로 gviz를 읽는다', () => {
  assert.equal(
    buildDataUrl({ sheetId: 'ID', publishUrl: '', mode: LUNCH }),
    'https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv&headers=1&sheet=%EA%B0%80%EA%B2%8C%EB%AA%A9%EB%A1%9D',
  );
});

test('buildDataUrl: 둘 다 없으면 예시 CSV', () => {
  assert.equal(buildDataUrl({ sheetId: '', publishUrl: '', mode: LUNCH }), 'data/sample-stores.csv');
});

test('availableModes: 게시 방식에서는 탭 번호가 빈 모드를 뺀다', () => {
  assert.deepEqual(availableModes([LUNCH, CAFE], PUB), [LUNCH]);
  assert.deepEqual(availableModes([LUNCH, { ...CAFE, gid: '5' }], PUB).map((m) => m.id), ['lunch', 'cafe']);
});

test('availableModes: gviz 방식에서는 탭 이름이 있으면 쓴다', () => {
  assert.deepEqual(availableModes([LUNCH, CAFE], '').map((m) => m.id), ['lunch', 'cafe']);
  assert.deepEqual(availableModes([LUNCH, { ...CAFE, tab: '' }], '').map((m) => m.id), ['lunch']);
});

test('buildEditUrl: 탭 번호가 있으면 그 탭을 연다', () => {
  assert.equal(buildEditUrl('', '0'), null);
  assert.equal(buildEditUrl('ID', ''), 'https://docs.google.com/spreadsheets/d/ID/edit');
  assert.equal(buildEditUrl('ID', '123'), 'https://docs.google.com/spreadsheets/d/ID/edit#gid=123');
});
