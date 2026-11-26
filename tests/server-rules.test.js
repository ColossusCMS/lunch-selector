import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWeather } from '../server/rules.js';
import { buildWeatherUrl, parseLunchWeather } from '../server/weather.js';
import { findUntagged, mergeTags, validateOutput } from '../server/tags.js';

const sample = (values) => ({ temperature: 20, probability: 0, precipitation: 0, code: 0, ...values });

test('날씨 경계값과 무난한 날 문구', () => {
  const checks = [
    [{ probability: 59 }, []], [{ probability: 60 }, ['rain']],
    [{ temperature: 5 }, ['cold']], [{ temperature: 5.1 }, []],
    [{ temperature: 27.9 }, []], [{ temperature: 28 }, ['hot']],
    [{ precipitation: 0.01 }, ['rain']],
  ];
  for (const [values, conditions] of checks) {
    assert.deepEqual(evaluateWeather([sample(values)]).weather.conditions, conditions);
  }
  const mild = evaluateWeather([sample()]);
  assert.equal(mild.weather.badge, '');
  assert.equal(mild.message, '오늘은 날씨 무난해요. 자유롭게 골라봐');
});

test('눈 시간대가 포함되면 눈 배지를 표시하고 겹친 조건의 태그를 합친다', () => {
  for (const code of [71, 77, 85, 86]) {
    const result = evaluateWeather([sample({ code, temperature: 5 }), sample({ temperature: 28 })]);
    assert.deepEqual(result.weather.conditions, ['rain', 'hot', 'cold']);
    assert.equal(result.weather.badge, '❄️ 오늘 눈');
    assert.equal(result.message, '비 오는 날엔 국물이나 튀김 어때?');
    assert.deepEqual(result.tags, new Set(['warm_soup', 'greasy', 'cold', 'light']));
  }
});

test('서울 날짜의 설정된 시간만 선택하고 누락된 시간은 실패한다', () => {
  const url = buildWeatherUrl({ lat: 37.569, lon: 126.674 });
  assert.equal(url.searchParams.get('timezone'), 'Asia/Seoul');
  assert.equal(url.searchParams.get('forecast_days'), '1');
  const payload = { hourly: {
    time: ['2026-11-25T11:00', '2026-11-26T10:00', '2026-11-26T11:00'],
    apparent_temperature: [100, 100, 5], precipitation_probability: [100, 100, 59],
    precipitation: [10, 10, 0], weather_code: [95, 95, 0],
  } };
  const date = new Date('2026-11-25T16:00:00Z');
  assert.deepEqual(parseLunchWeather(payload, date, [11]), [sample({ temperature: 5, probability: 59 })]);
  assert.throws(() => parseLunchWeather(payload, date, [12]), /데이터 누락/);
});

test('미분류만 추출하고 이미 저장된 태그와 빈 배열을 보존한다', () => {
  const tags = { 한식: [], 국밥: ['warm_soup'] };
  assert.deepEqual(findUntagged(['국밥', '한식', '냉면', 'constructor'], tags), ['냉면', 'constructor']);
  assert.deepEqual(mergeTags(tags, { 한식: ['light'], 국밥: [], 냉면: ['cold'] }),
    { 한식: [], 국밥: ['warm_soup'], 냉면: ['cold'] });
});

test('AI 출력에서 객체만 받고 요청하지 않은 키와 잘못된 태그를 걸러낸다', () => {
  const categories = ['냉면', '한식', '국밥'];
  assert.throws(() => validateOutput('json 아님', categories));
  assert.throws(() => validateOutput('[]', categories));
  const output = '```json\n{"냉면":["cold","unknown"],"한식":[],"국밥":"warm_soup","회":["light"]}\n```';
  assert.deepEqual(validateOutput(output, categories), { 냉면: ['cold'], 한식: [] });
});

test('강수 코드의 범위 경계와 비 단독 배지', () => {
  const checks = [[50, 51], [68, 67], [70, 71], [78, 77], [79, 80], [87, 86], [94, 95]];
  for (const [dry, wet] of checks) {
    assert.deepEqual(evaluateWeather([sample({ code: dry })]).weather.conditions, []);
    assert.deepEqual(evaluateWeather([sample({ code: wet })]).weather.conditions, ['rain']);
  }
  assert.equal(evaluateWeather([sample({ code: 51 })]).weather.badge, '☔ 오늘 비');
});

test('날씨 지표별 null을 걸러내고 전부 비어 있는 지표는 null로 응답한다', () => {
  const payload = { hourly: {
    time: ['2026-11-26T11:00', '2026-11-26T12:00'],
    apparent_temperature: [null, 28],
    precipitation_probability: [null, null],
    precipitation: [null, 0],
    weather_code: [null, null],
  } };
  const date = new Date('2026-11-26T01:00:00Z');
  const hours = [11, 12];
  assert.deepEqual(evaluateWeather(parseLunchWeather(payload, date, hours)).weather, {
    conditions: ['hot'], badge: '🥵 오늘 더움', apparentMin: 28, apparentMax: 28,
    precipitationProbabilityMax: null,
  });
  payload.hourly.apparent_temperature[1] = null;
  assert.deepEqual(evaluateWeather(parseLunchWeather(payload, date, hours)).weather, {
    conditions: [], badge: '', apparentMin: null, apparentMax: null, precipitationProbabilityMax: null,
  });
});
