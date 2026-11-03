import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratingKey, aggregateRatings, cardTier, formatStatLine, parsePick, pickStatus, buildRatingBody, applySendResults, dropIfSame } from '../js/rating.js';
test('aggregateRatings: 헤더 이름으로 읽고 모드+가게명으로 묶는다', () => {
  const rows = [
    ['타임스탬프', '가게명', '좋아요', '모드', '별점', '기타'],   // 순서 뒤섞임 + 여분 열
    ['t', '본죽', '1', 'lunch', '5', ''],
    ['t', ' 본죽 ', '', 'lunch', '4', ''],
    ['t', '본죽', '1', 'lunch', '', ''],
    ['t', '본죽', '1', 'cafe', '3', ''],
    ['t', '본죽', 'x', 'lunch', '9', ''],                          // 잘못된 값: 둘 다 무시
  ];
  const m = aggregateRatings(rows);
  assert.deepEqual(m.get(ratingKey('lunch', '본죽')), { likes: 2, avg: 4.5, count: 2 });
  assert.deepEqual(m.get(ratingKey('cafe', '본죽')), { likes: 1, avg: 3, count: 1 });
});
test('aggregateRatings: 빈 입력·필수 헤더 없음 → 빈 Map', () => {
  assert.equal(aggregateRatings([]).size, 0);
  assert.equal(aggregateRatings([['a', 'b'], ['1', '2']]).size, 0);
});
test('aggregateRatings: 평균은 소수 첫째 자리 반올림', () => {
  const rows = [['모드', '가게명', '별점', '좋아요'], ['l', 'A', '4', ''], ['l', 'A', '4', ''], ['l', 'A', '5', '']];
  assert.equal(aggregateRatings(rows).get(ratingKey('l', 'A')).avg, 4.3);
});
test('formatStatLine', () => {
  assert.deepEqual(formatStatLine({ likes: 12, avg: 4.2, count: 5 }, 'ruby', 'big'), { text: '★4.2 · 👍12', label: '평균 별점 4.2점, 좋아요 12개' });
  assert.deepEqual(formatStatLine({ likes: 0, avg: 3.5, count: 2 }, 'emerald', 'small'), { text: '★3.5', label: '평균 별점 3.5점' });
  assert.deepEqual(formatStatLine({ likes: 3, avg: 5, count: 1 }, 'unknown', 'big'), { text: '👍3 · 평가 부족', label: '좋아요 3개, 평가 부족' });
  assert.deepEqual(formatStatLine(undefined, 'unknown', 'big'), { text: '아직 평가가 부족해요', label: '아직 평가가 부족해요' });
  assert.deepEqual(formatStatLine(undefined, 'unknown', 'small'), { text: '평가 부족', label: '아직 평가가 부족해요' });
});

test('cardTier: 건수와 반올림 평균 경계', () => {
  assert.equal(cardTier(undefined).id, 'unknown');
  assert.equal(cardTier({ likes: 9, avg: 5, count: 1 }).id, 'unknown');
  for (const [avg, id] of [[2.9, 'stone'], [3, 'emerald'], [4, 'ruby'], [4.4, 'ruby'], [4.5, 'diamond']]) {
    assert.equal(cardTier({ likes: 0, avg, count: 2 }).id, id);
  }
  const rows = [['모드', '가게명', '별점', '좋아요'], ...Array.from({ length: 20 }, (_, i) => ['l', 'A', i < 9 ? '5' : '4', ''])];
  const stat = aggregateRatings(rows).get(ratingKey('l', 'A'));
  assert.equal(stat.avg, 4.5);
  assert.equal(cardTier(stat).id, 'diamond');
});

test('aggregateRatings: count는 유효 별점 개수', () => {
  const rows = [['모드', '가게명', '별점', '좋아요'], ['l', 'A', '4', '1'], ['l', 'A', '', '1'], ['l', 'A', '9', ''], ['l', 'A', '5', '']];
  assert.deepEqual(aggregateRatings(rows).get(ratingKey('l', 'A')), { likes: 2, avg: 4.5, count: 2 });
});
test('parsePick: 정상·깨진 값', () => {
  assert.deepEqual(parsePick('{"at":1,"mode":"lunch","names":["A"]}'), { at: 1, mode: 'lunch', names: ['A'] });
  for (const raw of [null, '', '{', '[]', '{"at":"x","mode":"l","names":["A"]}', '{"at":1,"mode":"l","names":[]}'])
    assert.equal(parsePick(raw), null, String(raw));
});
test('pickStatus: 30분 대기, 달력 3일, 모드 없음, 미래 시각', () => {
  const at = new Date(2026, 10, 6, 11, 50).getTime();          // 금 11:50 (로컬)
  const pick = { at, mode: 'lunch', names: ['A'] };
  const ids = ['lunch', 'cafe'];
  assert.equal(pickStatus(pick, at + 29 * 60e3, ids), 'wait');
  assert.equal(pickStatus(pick, at + 30 * 60e3, ids), 'ask');
  assert.equal(pickStatus(pick, new Date(2026, 10, 9, 23, 59).getTime(), ids), 'ask');   // 월(3일째)
  assert.equal(pickStatus(pick, new Date(2026, 10, 10, 0, 0).getTime(), ids), 'drop');  // 화(4일째)
  assert.equal(pickStatus({ ...pick, mode: 'gone' }, at + 60 * 60e3, ids), 'drop');
  assert.equal(pickStatus(pick, at - 24 * 60 * 60e3, ids), 'drop');                     // 시계가 하루 전으로
});
test('buildRatingBody', () => {
  const entries = { mode: 'entry.1', name: 'entry.2', stars: 'entry.3', like: 'entry.4' };
  const body = buildRatingBody(entries, { mode: 'lunch', name: '본죽', stars: 4, like: true });
  assert.equal(body.toString(), new URLSearchParams({ 'entry.1': 'lunch', 'entry.2': '본죽', 'entry.3': '4', 'entry.4': '1' }).toString());
  const empty = buildRatingBody(entries, { mode: 'lunch', name: '본죽', stars: null, like: false });
  assert.equal(empty.get('entry.3'), '');
  assert.equal(empty.get('entry.4'), '');
});
test('applySendResults: 실패한 가게만 남기고, 다 보내면 null, at 다르면 그대로', () => {
  const saved = { at: 5, mode: 'lunch', names: ['A', 'B', 'C'] };
  assert.deepEqual(applySendResults(saved, 5, ['A'], ['B']), { at: 5, mode: 'lunch', names: ['B'] });
  assert.equal(applySendResults(saved, 5, ['A', 'B'], []), null);
  assert.equal(applySendResults(saved, 4, ['A'], ['B']), saved);
  assert.equal(applySendResults(null, 5, ['A'], []), null);
});
test('dropIfSame', () => {
  const saved = { at: 5, mode: 'lunch', names: ['A'] };
  assert.equal(dropIfSame(saved, 5), null);
  assert.equal(dropIfSame(saved, 4), saved);
});
