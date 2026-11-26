import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecommendUrl, fetchRecommendation, formatRecommendationAnnouncement, formatUpdatedAt, parseRecommendation, pickVisibleCategories,
} from '../js/recommend.js';

const payload = {
  ok: true, region: '검암', categories: ['국밥'], weather: { badge: '☔ 오늘 비', conditions: ['rain'] },
  message: '비 오는 날엔 국물이나 튀김 어때요?', updatedAt: '2026-11-26T01:30:00.000Z', extra: true,
};
const expected = {
  region: '검암', categories: ['국밥'], badge: '☔ 오늘 비',
  message: payload.message, updatedAt: payload.updatedAt, source: 'rule',
  weather: { badge: '☔ 오늘 비', conditions: ['rain'], apparentMin: null, apparentMax: null,
    precipitationProbabilityMax: null },
};

test('추천 계약의 필요한 필드만 반환한다', () => {
  const recommendation = parseRecommendation(payload);
  assert.deepEqual(recommendation, expected);
  assert.notEqual(recommendation.categories, payload.categories);
  assert.deepEqual(parseRecommendation({ ...payload, weather: { badge: '' }, categories: [] }), {
    ...expected, badge: '', categories: [],
    weather: { ...expected.weather, badge: '', conditions: [] },
  });
});

test('실패 응답, 누락 필드, 잘못된 타입과 날짜를 거부한다', () => {
  assert.equal(parseRecommendation(null), null);
  assert.equal(parseRecommendation({ ...payload, ok: false }), null);
  for (const [key, invalid] of Object.entries({
    ok: 'true', region: 1, categories: [1], weather: { badge: 1 }, message: 1, updatedAt: 1,
  })) {
    const incomplete = { ...payload };
    delete incomplete[key];
    assert.equal(parseRecommendation(incomplete), null, key);
    assert.equal(parseRecommendation({ ...payload, [key]: invalid }), null, key);
  }
  assert.equal(parseRecommendation({ ...payload, weather: {} }), null);
  assert.equal(parseRecommendation({ ...payload, categories: '국밥' }), null);
  assert.equal(parseRecommendation({ ...payload, updatedAt: '날짜 아님' }), null);
});

test('추천 조회는 성공을 해석하고 HTTP·JSON·네트워크 오류를 null로 반환한다', async () => {
  assert.deepEqual(await fetchRecommendation('/recommend', async () => Response.json(payload)), expected);
  for (const status of [404, 503]) {
    assert.equal(await fetchRecommendation('/recommend', async () => new Response('', { status })), null);
  }
  assert.equal(await fetchRecommendation('/recommend', async () => new Response('{')), null);
  assert.equal(await fetchRecommendation('/recommend', () => { throw new Error('offline'); }), null);
});

test('응답 본문을 기다리는 중에도 시간 제한이 적용되고 요청을 중단한다', async () => {
  let signal;
  let reading = false;
  const result = await fetchRecommendation('/recommend', async (_, options) => {
    signal = options.signal;
    return { ok: true, json: () => { reading = true; return new Promise(() => {}); } };
  }, { timeout: 10 });
  assert.equal(result, null);
  assert.equal(reading, true);
  assert.equal(signal.aborted, true);
});

test('교집합은 화면 순서를 유지하고 일치 항목이 없으면 비어 있다', () => {
  assert.deepEqual(pickVisibleCategories(['포케', '국밥', '냉면'], ['국밥', '포케', '찌개']), ['국밥', '포케']);
  assert.deepEqual(pickVisibleCategories(['포케'], ['국밥']), []);
});

test('추천 URL의 한글 지역을 인코딩한다', () => {
  assert.equal(buildRecommendUrl('https://example.com', '검암'),
    'https://example.com/recommend?region=%EA%B2%80%EC%95%94');
});

test('UTC 시각을 서울 시각으로 표시하며 자정은 00시다', () => {
  assert.equal(formatUpdatedAt('2026-11-26T01:30:00.000Z'), '10:30');
  assert.equal(formatUpdatedAt('2026-11-26T15:05:00Z'), '00:05');
});

test('추천 안내는 실제로 적용한 경우에만 적용 업종 수를 읽는다', () => {
  assert.equal(formatRecommendationAnnouncement('오늘 비', 2), 'AI 메뉴 추천: 오늘 비 업종 2개를 켰어요');
  assert.equal(formatRecommendationAnnouncement('오늘 비', null), 'AI 메뉴 추천: 오늘 비');
  assert.equal(formatRecommendationAnnouncement('오늘 비', 0), 'AI 메뉴 추천: 오늘 비 추천 업종이 지금 화면에 없어요');
});

test('AI 이외의 출처는 v2.4 응답과 같이 규칙으로 처리한다', () => {
  assert.equal(parseRecommendation(payload).source, 'rule');
  assert.equal(parseRecommendation({ ...payload, source: 'unknown' }).source, 'rule');
  assert.equal(parseRecommendation({ ...payload, source: 'ai' }).source, 'ai');
});
