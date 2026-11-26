import assert from 'node:assert/strict';
import test from 'node:test';
import { activeNotices, hideNotice, parseNotices, readHidden, todayInSeoul } from '../js/notice.js';
import { parseCsv } from '../js/csv.js';

const header = ['ID', '사용', '시작일', '종료일', '제목', '내용', '버튼', '링크'];
const day = '2026-11-26';
const row = (id, use = 'TRUE', start = day, end = '', title = '제목', content = '내용', button = '', url = '') =>
  [id, use, start, end, title, content, button, url];

test('실제 열 이름, 순서 변경, 선택 열 생략, CSV 셀 줄바꿈 처리', () => {
  const notices = parseNotices(parseCsv(header.join(',') + '\n공지-오류,TRUE,2026-11-26,,제목,내용\n'
    + 'beta-1,TRUE,2026-11-26,,제목,"첫 줄\n둘째 줄",,https://example.com/page'));
  assert.equal(notices.length, 1);
  assert.equal(notices[0].content, '첫 줄\n둘째 줄');
  assert.equal(notices[0].button, '자세히 보기');
  assert.equal(notices[0].row, 3);
  assert.equal(parseNotices([['내용', ' id ', '시작일', ' 제목 ', '사용'],
    ['내용', 'beta', day, '제목', 'Y']])[0].id, 'beta');
  for (const required of ['ID', '사용', '시작일', '제목', '내용']) {
    assert.deepEqual(parseNotices([header.filter((name) => name !== required), row('one')]), []);
  }
});

test('켜진 공지만 읽고 체크박스 빈 행과 잘못된 날짜·ID·필수 값을 건너뛴다', () => {
  const good = [row('one', ' true '), row('two', 'o'), row('three', 'Y')];
  const bad = [
    ...['FALSE', '0', '1', ''].map((value, index) => row('off-' + index, value)),
    row('x'.repeat(41)), row('<id>'), row('date-a', 'TRUE', '2026-2-01'),
    row('date-b', 'TRUE', '2026-02-30'), row('date-c', 'TRUE', day, '2026-11-25'),
    row('no-title', 'TRUE', day, '', ' '), row('no-content', 'TRUE', day, '', '제목', ''),
  ];
  assert.deepEqual(parseNotices([header, ...good, ...bad, ...Array(1000).fill(['', 'FALSE'])])
    .map(({ id }) => id), ['one', 'two', 'three']);
});

test('아래쪽 중복 행이 우선하고 링크는 유효한 HTTPS만 남긴다', () => {
  const notices = parseNotices([header, row('same'), row('disabled'), row('disabled', 'FALSE'),
    row('same', 'TRUE', day, '', '새 공지', '내용', '링크', 'http://example.com'),
    row('bad-url', 'TRUE', day, '', '제목', '내용', '링크', 'https://'),
    row('valid', 'TRUE', day, '', '제목', '내용', '열기', 'https://example.com/guide')]);
  assert.deepEqual(notices.map(({ id, title, button }) => [id, title, button]), [
    ['same', '새 공지', ''], ['bad-url', '제목', ''], ['valid', '제목', '열기'],
  ]);
});

test('시작일과 종료일을 포함하고 최신 시작일·마지막 행 순으로 최대 세 개를 고른다', () => {
  const notices = parseNotices([header, row('open', 'TRUE', '2026-11-25'), row('first'),
    row('second', 'TRUE', day, day), row('third'), row('future', 'TRUE', '2026-11-27'),
    row('expired', 'TRUE', '2026-11-23', '2026-11-25')]);
  assert.deepEqual(activeNotices(notices, day, {}).map(({ id }) => id), ['third', 'second', 'first']);
  assert.deepEqual(activeNotices(notices, day, { first: 'forever', third: day }).map(({ id }) => id),
    ['second', 'open']);
});

test('서울 자정 경계와 숨김 저장값 정리 및 불변성', () => {
  assert.equal(todayInSeoul(Date.parse('2026-11-26T14:59:00Z')), day);
  assert.equal(todayInSeoul(Date.parse('2026-11-26T15:00:00Z')), '2026-11-27');
  const old = { past: '2026-11-25', now: day, always: 'forever' };
  const hidden = readHidden(JSON.stringify(old), day);
  assert.deepEqual(hidden, { now: day, always: 'forever' });
  assert.deepEqual(hideNotice(hidden, 'beta', 'today', day), { ...hidden, beta: day });
  assert.deepEqual(hideNotice(hidden, 'beta', 'forever', day), { ...hidden, beta: 'forever' });
  assert.equal(Object.hasOwn(hidden, 'beta'), false);
  for (const raw of ['{', '[]', '{"x":1}', '{"x":"2026-02-30"}', '{"<x>":"forever"}']) {
    assert.deepEqual(readHidden(raw, day), {});
  }
});

test('숨김 저장값에서 잘못된 항목만 제거하고 정상 숨김은 유지한다', () => {
  const raw = JSON.stringify({
    keep: 'forever', current: day, old: '2026-11-25',
    'bad/key': 'forever', malformed: '2026-02-30', number: 5, missing: null,
  });
  assert.deepEqual(readHidden(raw, day), { keep: 'forever', current: day });
});
