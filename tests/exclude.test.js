import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXCLUDE_KEY, EXCLUDE_DAYS, readExcluded, withoutExcluded } from '../js/exclude.js';
import { ratingKey } from '../js/rating.js';

const DAY = 86400000;
const now = new Date(2026, 10, 4, 12).getTime();

test('제외 저장 키와 기간은 한 상수로 관리', () => {
  assert.equal(EXCLUDE_KEY, 'lunch-selector:excluded');
  assert.equal(EXCLUDE_DAYS, 7);
});

test('6일 전과 현재 제외 유지, 정확히 7일 전부터 만료', () => {
  const raw = JSON.stringify({ recent: now - 6 * DAY, boundary: now - 7 * DAY, old: now - 8 * DAY, current: now });
  assert.deepEqual(readExcluded(raw, now), { recent: now - 6 * DAY, current: now });
});

test('깨진 JSON·배열·객체 아닌 저장값은 빈 기록', () => {
  for (const raw of [null, '', '{', '[]', '[1]', '1', 'null', 'true', '"text"']) {
    assert.deepEqual(readExcluded(raw, now), {}, String(raw));
  }
});

test('숫자 아닌 시각·미래 시각은 무시하고 유효 항목은 보존', () => {
  const raw = JSON.stringify({ text: String(now), nil: null, bool: true, array: [], object: {}, future: now + 1, valid: now - 1 });
  assert.deepEqual(readExcluded(raw, now), { valid: now - 1 });
});

test('제외한 후보만 빼고 원본 배열과 저장값은 유지', () => {
  const stores = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const excluded = { B: now };
  assert.deepEqual(withoutExcluded(stores, excluded, (s) => s.name), { list: [stores[0], stores[2]], fallback: false });
  assert.equal(stores.length, 3);
  assert.deepEqual(excluded, { B: now });
});

test('모든 후보 제외 시 원본 후보 반환과 대체 표시, 원래 빈 후보는 대체 아님', () => {
  const stores = [{ name: 'A' }];
  const result = withoutExcluded(stores, { A: now }, (s) => s.name);
  assert.equal(result.list, stores);
  assert.equal(result.fallback, true);
  assert.deepEqual(withoutExcluded([], {}, (s) => s.name), { list: [], fallback: false });
});

test('같은 가게 이름도 모드·지역이 다르면 별개 제외 키', () => {
  const stores = [{ mode: 'lunch', region: '검암', name: 'A' }, { mode: 'cafe', region: '검암', name: 'A' }, { mode: 'lunch', region: '을지로', name: 'A' }];
  const keyOf = (s) => ratingKey(s.mode, s.region, s.name);
  const excluded = { [keyOf(stores[0])]: now };
  assert.deepEqual(withoutExcluded(stores, excluded, keyOf).list, stores.slice(1));
});

test('상속 속성은 제외 기록으로 취급하지 않는다', () => {
  const stores = [{ name: 'constructor' }, { name: 'toString' }];
  assert.deepEqual(withoutExcluded(stores, {}, (s) => s.name).list, stores);
});

test('포함 옵션은 일부·전체 제외와 빈 후보 모두 원본 반환, 대체 안내 없음', () => {
  const stores = [{ name: 'A' }, { name: 'B' }];
  for (const excluded of [{ A: now }, { A: now, B: now }]) {
    const result = withoutExcluded(stores, excluded, (s) => s.name, { include: true });
    assert.equal(result.list, stores);
    assert.equal(result.fallback, false);
    assert.deepEqual(stores, [{ name: 'A' }, { name: 'B' }]);
    assert.equal(excluded.A, now);
  }
  assert.deepEqual(withoutExcluded([], {}, (s) => s.name, { include: true }), { list: [], fallback: false });
});

test('포함 옵션 false는 기존 제외·전부 제외 대체 동작 유지', () => {
  const stores = [{ name: 'A' }, { name: 'B' }];
  for (const excluded of [{ A: now }, { A: now, B: now }]) {
    assert.deepEqual(withoutExcluded(stores, excluded, (s) => s.name, { include: false }),
      withoutExcluded(stores, excluded, (s) => s.name));
  }
});
