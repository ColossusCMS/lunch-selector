import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listRegions, listGroups, listCategories, filterCandidates, closedToday, pickTop } from '../js/select.js';
import { rowsToStores } from '../js/stores.js';

const store = (name, categories, groups, closedDays, region = '') =>
  ({ name, categories, groups, closedDays, region, memo: '' });

// 스펙 4.1 예시 데이터
const S = [
  store('김밥천국', ['분식', '한식'], ['1팀', '2팀'], [0]),
  store('홍콩반점', ['중식'], ['1팀'], [0, 6]),
  store('본죽', ['한식'], ['2팀'], [0]),
  store('진짜맛집', ['중식', '한식'], ['1팀', '2팀'], [1]),
  store('서브웨이', ['양식'], ['2팀'], []),
  store('국수나무', ['한식'], ['1팀'], [3]),
];
const names = (arr) => arr.map((s) => s.name);

test('중복 시트 행을 합친 후보는 추첨 순위에 같은 가게가 겹치지 않는다', (t) => {
  t.mock.method(console, 'warn', () => {});
  const candidates = rowsToStores([['가게명', '지역'],
    ['김밥', '검암'], ['김밥', '검암'], ['국밥', '검암'], ['냉면', '검암']]);
  assert.equal(candidates.length, 3);
  for (let i = 0; i < 100; i++) {
    const picks = pickTop(candidates, 3, () => i / 100);
    assert.equal(new Set(picks.map(s => s.name)).size, 3);
  }
});

test('지역별 그룹·업종·휴무 분리와 그룹 없는 지역', () => {
  const stores = [store('A', ['한식'], ['3층'], [1], '검암'), store('B', ['중식'], ['3층'], [1], '을지로'), store('C', ['분식'], [], [], '검암'), store('D', [], [], [], '판교')];
  assert.deepEqual(listRegions(stores), ['검암', '을지로', '판교']);
  assert.deepEqual(listGroups(stores, '판교'), []);
  assert.deepEqual(listCategories(stores, '검암', null), ['분식', '한식']);
  assert.deepEqual(names(closedToday(stores, '검암', '3층', 1)), ['A']);
  assert.deepEqual(names(filterCandidates(stores, { region: '검암', group: null, categories: [], day: 2 })), ['A', 'C']);
  assert.deepEqual(names(filterCandidates(stores, { region: '을지로', group: '3층', categories: [], day: 2 })), ['B']);
});

test('listGroups', () => assert.deepEqual(listGroups(S, ''), ['1팀', '2팀']));

test('listCategories(1팀)', () => assert.deepEqual(listCategories(S, '', '1팀'), ['분식', '중식', '한식']));

test('월요일 1팀: 휴무 제외', () =>
  assert.deepEqual(names(filterCandidates(S, { region: '', group: '1팀', categories: [], day: 1 })), ['김밥천국', '홍콩반점', '국수나무']));

test('일요일 1팀 → 영업 중인 가게', () =>
  assert.deepEqual(names(filterCandidates(S, { region: '', group: '1팀', categories: [], day: 0 })), ['진짜맛집', '국수나무']));

test('업종 필터는 OR', () =>
  assert.deepEqual(
    names(filterCandidates(S, { region: '', group: '2팀', categories: ['양식', '분식'], day: 2 })),
    ['김밥천국', '서브웨이'],
  ));

test('필터를 켜면 업종이 빈 가게는 제외', () => {
  const T = [...S, store('무업종', [], ['2팀'], [])];
  assert.ok(!names(filterCandidates(T, { region: '', group: '2팀', categories: ['한식'], day: 2 })).includes('무업종'));
  assert.ok(names(filterCandidates(T, { region: '', group: '2팀', categories: [], day: 2 })).includes('무업종'));
});

test('closedToday: 그룹 소속·오늘 휴무', () =>
  assert.deepEqual(names(closedToday(S, '', '1팀', 0)), ['김밥천국', '홍콩반점']));

test('closedToday: 수요일 휴무 가게 포함', () =>
  assert.deepEqual(names(closedToday(S, '', '1팀', 3)), ['국수나무']));

test('pickTop: 중복 없음·최대 3·입력 불변', () => {
  const c = filterCandidates(S, { region: '', group: '2팀', categories: [], day: 2 });
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

// 그룹 null = 전체
test('전체 그룹: 그룹 구분 없이 후보 (중복 없음)', () =>
  assert.deepEqual(
    names(filterCandidates(S, { region: '', group: null, categories: [], day: 1 })),
    ['김밥천국', '홍콩반점', '본죽', '서브웨이', '국수나무'],
  ));

test('전체 그룹: 그룹이 빈 가게도 포함', () => {
  const T = [...S, store('무소속', ['한식'], [], [])];
  assert.ok(names(filterCandidates(T, { region: '', group: null, categories: [], day: 2 })).includes('무소속'));
});

test('전체 그룹: listCategories는 모든 가게의 업종', () =>
  assert.deepEqual(listCategories(S, '', null), ['분식', '양식', '중식', '한식']));

test('전체 그룹: closedToday는 모든 그룹의 휴무', () =>
  assert.deepEqual(names(closedToday(S, '', null, 0)), ['김밥천국', '홍콩반점', '본죽']));
