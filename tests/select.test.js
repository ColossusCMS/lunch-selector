import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listGroups, listCategories, filterCandidates, closedToday, pickTop } from '../js/select.js';

const store = (name, categories, groups, closedDays, enabled = true) =>
  ({ name, categories, groups, closedDays, enabled, memo: '' });

// 스펙 4.1 예시 데이터
const S = [
  store('김밥천국', ['분식', '한식'], ['1팀', '2팀'], [0]),
  store('홍콩반점', ['중식'], ['1팀'], [0, 6]),
  store('본죽', ['한식'], ['2팀'], [0]),
  store('진짜맛집', ['중식', '한식'], ['1팀', '2팀'], [1]),
  store('서브웨이', ['양식'], ['2팀'], []),
  store('국수나무', ['한식'], ['1팀'], [3], false),
];
const names = (arr) => arr.map((s) => s.name);

test('listGroups', () => assert.deepEqual(listGroups(S), ['1팀', '2팀']));

test('listCategories(1팀)', () => assert.deepEqual(listCategories(S, '1팀'), ['분식', '중식', '한식']));

test('월요일 1팀: 휴무·미사용 제외', () =>
  assert.deepEqual(names(filterCandidates(S, { group: '1팀', categories: [], day: 1 })), ['김밥천국', '홍콩반점']));

test('일요일 1팀 → 진짜맛집만', () =>
  assert.deepEqual(names(filterCandidates(S, { group: '1팀', categories: [], day: 0 })), ['진짜맛집']));

test('업종 필터는 OR', () =>
  assert.deepEqual(
    names(filterCandidates(S, { group: '2팀', categories: ['양식', '분식'], day: 2 })),
    ['김밥천국', '서브웨이'],
  ));

test('필터를 켜면 업종이 빈 가게는 제외', () => {
  const T = [...S, store('무업종', [], ['2팀'], [])];
  assert.ok(!names(filterCandidates(T, { group: '2팀', categories: ['한식'], day: 2 })).includes('무업종'));
  assert.ok(names(filterCandidates(T, { group: '2팀', categories: [], day: 2 })).includes('무업종'));
});

test('closedToday: 그룹 소속·사용 중·오늘 휴무', () =>
  assert.deepEqual(names(closedToday(S, '1팀', 0)), ['김밥천국', '홍콩반점']));

test('closedToday: 미사용 가게는 휴무 목록에도 없음', () =>
  assert.deepEqual(names(closedToday(S, '1팀', 3)), []));

test('pickTop: 중복 없음·최대 3·입력 불변', () => {
  const c = filterCandidates(S, { group: '2팀', categories: [], day: 2 });
  const copy = [...c];
  for (let i = 0; i < 50; i++) {
    const r = pickTop(c);
    assert.equal(r.length, 3);
    assert.equal(new Set(r).size, 3);
  }
  assert.deepEqual(c, copy);
});

test('pickTop: 후보 부족', () => {
  assert.equal(pickTop(S.slice(0, 2)).length, 2);
  assert.deepEqual(pickTop([]), []);
});

test('pickTop: rng 주입 시 결정적', () => {
  const rng = () => 0;
  assert.deepEqual(names(pickTop(S.slice(0, 4), 3, rng)), names(pickTop(S.slice(0, 4), 3, rng)));
});

test('pickTop: 모든 후보가 1순위로 나올 수 있음', () => {
  const c = S.slice(0, 4);
  const firsts = new Set();
  for (let i = 0; i < 400; i++) firsts.add(pickTop(c)[0].name);
  assert.equal(firsts.size, 4);
});
