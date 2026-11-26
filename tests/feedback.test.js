import assert from 'node:assert/strict';
import test from 'node:test';
import { FEEDBACK, feedbackEnabled } from '../js/config.js';
import { buildFeedbackBody, feedbackContext, formatWeatherSummary, shouldAutoPrompt } from '../js/feedback.js';

test('피드백 설정은 폼과 9개 entry가 모두 있어야 활성화된다', () => {
  assert.equal(feedbackEnabled(FEEDBACK), true);
  assert.equal(feedbackEnabled({ ...FEEDBACK, formUrl: ' ' }), false);
  for (const key of Object.keys(FEEDBACK.entries)) {
    assert.equal(feedbackEnabled({ ...FEEDBACK, entries: { ...FEEDBACK.entries, [key]: '' } }), false);
  }
});

test('폼 본문은 설정된 entry로 매핑하고 공백과 500 코드포인트를 정리하며 빈 값도 유지한다', () => {
  const data = { feature: 4, result: 5, comment: ' ' + '🍜'.repeat(501) + ' ', region: '검암',
    weather: '', categories: '국밥, 칼국수', source: 'ai', store: '', version: 'v2.5' };
  const body = buildFeedbackBody(FEEDBACK.entries, data);
  assert.equal(body.size, 9);
  for (const [key, entry] of Object.entries(FEEDBACK.entries)) {
    assert.equal(body.get(entry), key === 'comment' ? '🍜'.repeat(500) : String(data[key]));
  }
});

test('날씨 요약은 비·눈·더위·추위 우선순위를 지키고 null 수치를 뺀다', () => {
  const stats = { apparentMin: 3, apparentMax: 6, precipitationProbabilityMax: 80, badge: '' };
  assert.equal(formatWeatherSummary({ conditions: ['hot', 'rain', 'cold'], ...stats }), '비 · 체감 3~6℃ · 강수 80%');
  assert.equal(formatWeatherSummary({ conditions: ['rain'], ...stats, badge: '❄️ 오늘 눈' }), '눈 · 체감 3~6℃ · 강수 80%');
  assert.equal(formatWeatherSummary({ conditions: ['cold', 'hot'] }), '더움');
  assert.equal(formatWeatherSummary({ conditions: ['cold'], apparentMin: null, apparentMax: 5 }), '추움 · 체감 5℃');
  assert.equal(formatWeatherSummary({ conditions: [], precipitationProbabilityMax: 0 }), '무난 · 강수 0%');
  assert.equal(formatWeatherSummary(null), '');
});

test('자동 표시는 추천을 켠 점심의 첫 결과에서만 가능하다', () => {
  const options = { enabled: true, recommendOn: true, mode: 'lunch', prompted: false };
  assert.equal(shouldAutoPrompt(options), true);
  for (const replacement of [{ enabled: false }, { recommendOn: false }, { mode: 'cafe' }, { prompted: true }]) {
    assert.equal(shouldAutoPrompt({ ...options, ...replacement }), false);
  }
});

test('피드백은 지역 응답과 마지막 당첨 가게를 조립하고 끄면 출처를 off로 보낸다', () => {
  const input = { region: '검암', recommendOn: true, store: '든든국밥', version: 'v2.5',
    recommendation: { source: 'ai', categories: ['국밥', '쌀국수'], weather: { conditions: [] } } };
  assert.deepEqual(feedbackContext(input), {
    region: '검암', source: 'ai', categories: '국밥, 쌀국수', weather: '무난',
    store: '든든국밥', version: 'v2.5',
  });
  assert.equal(feedbackContext({ ...input, recommendOn: false }).source, 'off');
  assert.deepEqual(feedbackContext({ version: 'v2.5', recommendOn: true }), {
    region: '', source: '', categories: '', weather: '', store: '', version: 'v2.5',
  });
});
