import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMulti, parseDays, rowsToStores } from '../js/stores.js';

test('지역·혼잡도 정규화와 경고, 사용여부 무시', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const result = rowsToStores([
    ['가게명', '지역', '혼잡도', '사용여부'],
    ['A', ' 검암，을지로 ', ' 여유 ', 'FALSE'], ['B', '', '', ''],
    ['C', '판교', '오타', ''], ['D', '판교', '보통', ''], ['E', '판교', '혼잡', ''],
  ]);
  assert.deepEqual(result.map((s) => [s.region, s.crowd]), [['검암', '여유'], ['판교', null], ['판교', '보통'], ['판교', '혼잡']]);
  assert.equal(warn.mock.callCount(), 3);
  assert.ok(result.every((s) => !('enabled' in s)));
});

test('지역 열 전체 빈칸은 하위 호환, 그룹 빈칸 경고 없음', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.equal(rowsToStores([['가게명', '지역'], ['A', '  ']])[0].region, '');
  assert.equal(warn.mock.callCount(), 0);
});

test('지역 첫 값이 비면 첫 유효 값을 쓰고 쉼표만 있으면 경고 후 제외', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const stores = rowsToStores([
    ['가게명', '지역'], ['A', ',을지로'], ['B', ' ， 검암，판교'], ['C', ', ， '],
  ]);
  assert.deepEqual(stores.map((s) => [s.name, s.region]), [['A', '을지로'], ['B', '검암']]);
  assert.equal(warn.mock.callCount(), 3);
  assert.ok(warn.mock.calls.some((call) => /지역이 비어.*C/.test(call.arguments[0])));
  assert.deepEqual(rowsToStores([['가게명', '지역'], ['쉼표뿐', ',，']]), []);
});

test('splitMulti: 공백·전각 쉼표·빈 값·중복 처리', () => {
  assert.deepEqual(splitMulti(' 중식, 한식 ，중식,, '), ['중식', '한식']);
  assert.deepEqual(splitMulti(''), []);
});

test('parseDays: 요일 문자를 getDay 숫자로', () => {
  assert.deepEqual(parseDays('토,일'), [0, 6]);
  assert.deepEqual(parseDays('월요일, 수'), [1, 3]);
});

test('parseDays: 모르는 값은 무시', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.deepEqual(parseDays('매주 x'), []);
});

test('rowsToStores: 헤더 순서 무관·공백/BOM 헤더·모르는 열 무시·빈 가게명 건너뜀', () => {
  const rows = [
    ['﻿가게명', ' 그룹 ', '업종', '정기휴무', '사용여부', '메모', '전화'],
    ['김밥천국', '1팀,2팀', '분식,한식', '일', 'TRUE', '', '010'],
    ['', '', '', '', '', '', ''],
    ['국수나무', '1팀', '한식', '수', 'FALSE', '사용 안 함', ''],
  ];
  assert.deepEqual(rowsToStores(rows), [
    { name: '김밥천국', groups: ['1팀', '2팀'], categories: ['분식', '한식'], closedDays: [0], region: '', crowd: null, memo: '', address: '' },
    { name: '국수나무', groups: ['1팀'], categories: ['한식'], closedDays: [3], region: '', crowd: null, memo: '사용 안 함', address: '' },
  ]);
});

test('rowsToStores: 선택 열이 없어도 동작', () => {
  assert.deepEqual(rowsToStores([['가게명', '그룹'], ['본죽', '2팀']]), [
    { name: '본죽', groups: ['2팀'], categories: [], closedDays: [], region: '', crowd: null, memo: '', address: '' },
  ]);
});

test('rowsToStores: 짧은 행(뒤쪽 칸 누락)도 동작', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.deepEqual(rowsToStores([['가게명', '그룹', '메모'], ['본죽']]), [
    { name: '본죽', groups: [], categories: [], closedDays: [], region: '', crowd: null, memo: '', address: '' },
  ]);
});

test('rowsToStores: 가게명 열 없으면 throw', () => {
  assert.throws(() => rowsToStores([['이름'], ['x']]), /가게명/);
  assert.throws(() => rowsToStores([]), /가게명/);
});

test('parseDays: 쉼표 없이 적은 휴무도 모두 인식', () => {
  assert.deepEqual(parseDays('토 일'), [0, 6]);
  assert.deepEqual(parseDays('토일'), [0, 6]);
  assert.deepEqual(parseDays('토/일'), [0, 6]);
  assert.deepEqual(parseDays('토·일'), [0, 6]);
  assert.deepEqual(parseDays('토요일 일요일'), [0, 6]);
});

test('parseDays: 요일이 아닌 글자가 섞이면 경고하고 무시', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.deepEqual(parseDays('일, 매주'), [0]);
  assert.equal(warn.mock.callCount(), 1);
});

test('rowsToStores: 주소 열을 앞뒤 공백 없이 읽는다', () => {
  const [store] = rowsToStores([['가게명', '그룹', '주소'], ['본죽', '2팀', ' 서울 중구 세종대로 110 ']]);
  assert.equal(store.address, '서울 중구 세종대로 110');
});
