import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { createApp } from '../server/app.js';

const MINUTE = 60_000;
const SHEET_URL = 'https://example.com/sheet.csv';
const CSV = '가게명,업종,지역\n첫째,국밥,검암\n둘째,돈까스,검암\n셋째,쌀국수,을지로\n넷째,마라탕,검암';
const rain = {
  hourly: {
    time: ['2026-11-26T11:00'], apparent_temperature: [10],
    precipitation_probability: [60], precipitation: [0], weather_code: [0],
  },
};

function createFixture({
  classify, classifier = classify ? 'claude' : 'off', logger = console,
  csv = CSV, recommender = { recommender: 'off' }, tagStore, start = '2026-11-26T01:00:00Z',
} = {}) {
  let time = Date.parse(start);
  let tags = { 국밥: ['warm_soup'], 돈까스: ['greasy'], 쌀국수: ['warm_soup'] };
  const failures = new Set();
  const requests = [];
  let hourly = rain.hourly;
  const { handler, warmUp } = createApp({
    config: {
      allowedOrigins: ['https://colossuscms.github.io'],
      regions: { 검암: { lat: 37, lon: 126 }, 을지로: { lat: 38, lon: 127 } },
      lunchHours: [11], sheetCsvUrl: SHEET_URL, classifier, ...recommender,
    },
    now: () => time,
    fetchFn: async (url) => {
      const source = url === SHEET_URL ? 'sheet' : 'weather';
      requests.push(source);
      if (failures.has(source)) return new Response('', { status: 503 });
      if (source === 'sheet') return new Response(csv);
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(time);
      return Response.json({ hourly: { ...hourly, time: [day + 'T11:00'] } });
    },
    tagStore: tagStore ?? {
      read: async () => tags,
      merge: async (additions) => { tags = { ...tags, ...additions }; },
    },
    classify,
    logger,
  });

  return {
    requests, failures, warmUp,
    setCsv: (value) => { csv = value; },
    setWeather: (value) => { hourly = { ...rain.hourly, ...value }; },
    tick: (milliseconds) => { time += milliseconds; },
    async request(url, { origin, method = 'GET' } = {}) {
      const headers = {};
      const result = { headers };
      await handler({
        url: encodeURI(url), method, headers: { origin },
      }, {
        setHeader: (name, value) => { headers[name] = value; },
        writeHead: (status) => { result.status = status; },
        end: (body) => { result.body = body === undefined ? undefined : JSON.parse(body); },
      });
      return result;
    },
  };
}

test('응답은 시트에 적힌 해당 지역 업종만 포함하고 중복 요청은 원본을 공유한다', async () => {
  const fixture = createFixture();
  const [first, second] = await Promise.all([
    fixture.request('/recommend?region=검암'), fixture.request('/recommend?region=검암'),
  ]);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, second.body);
  assert.deepEqual(first.body.categories, ['국밥', '돈까스']);
  assert.deepEqual(first.body.weather.conditions, ['rain']);
  assert.deepEqual(first.body.basis, ['weather']);
  assert.deepEqual(fixture.requests, ['weather', 'sheet']);
  const other = await fixture.request('/recommend?region=을지로');
  assert.deepEqual(other.body.categories, ['쌀국수']);
  assert.deepEqual(fixture.requests, ['weather', 'sheet', 'weather']);
});

test('지역 누락, 모르는 지역, CORS 허용·거부와 OPTIONS 응답을 처리한다', async () => {
  const warnings = [];
  const fixture = createFixture({ logger: { warn: (message) => warnings.push(message) } });
  const allowed = 'https://colossuscms.github.io';
  const missing = await fixture.request('/recommend', { origin: allowed });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body, { ok: false, reason: 'bad-request' });
  assert.equal(missing.headers['Access-Control-Allow-Origin'], allowed);
  assert.equal(missing.headers.Vary, 'Origin');
  assert.equal(missing.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(missing.headers['Cache-Control'], 'no-store');

  const unknown = await fixture.request('/recommend?region=없는곳', { origin: 'https://example.com' });
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, { ok: false, reason: 'unknown-region' });
  assert.equal(unknown.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(unknown.headers.Vary, undefined);
  assert.deepEqual(warnings, ['좌표 없음: 없는곳']);

  const options = await fixture.request('/recommend', { origin: allowed, method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.equal(options.body, undefined);
  assert.equal(options.headers['Access-Control-Allow-Origin'], allowed);
  assert.equal((await fixture.request('/recommend', { method: 'POST' })).status, 405);
  assert.deepEqual(fixture.requests, []);
});

test('새로 읽기 실패 시 6시간까지 캐시를 쓰고 날씨 수신 시각을 보존한다', async () => {
  const fixture = createFixture();
  const get = () => fixture.request('/recommend?region=검암');
  const fresh = await get();
  fixture.failures.add('weather');
  fixture.failures.add('sheet');
  fixture.tick(10 * MINUTE);
  assert.equal((await get()).status, 200);
  assert.deepEqual(fixture.requests, ['weather', 'sheet', 'sheet']);
  fixture.tick(350 * MINUTE);
  assert.deepEqual((await get()).body, fresh.body);
  fixture.tick(1);
  assert.deepEqual((await get()).body, { ok: false, reason: 'weather-unavailable' });
  fixture.failures.delete('weather');
  fixture.tick(5 * MINUTE);
  assert.deepEqual((await get()).body, { ok: false, reason: 'sheet-unavailable' });
});

test('시트 갱신 때만 백그라운드 분류하고 실패 후 한 시간 동안 재시도하지 않는다', async () => {
  let attempts = 0;
  const first = Promise.withResolvers();
  const fixture = createFixture({ classify: (prompt) => {
    assert.match(prompt, /업종: \["마라탕"\]$/);
    return ++attempts === 1 ? first.promise : '{"마라탕":["warm_soup"]}';
  } });
  const get = () => fixture.request('/recommend?region=검암');
  const health = async () => (await fixture.request('/health')).body;

  assert.deepEqual(await health(), { ok: true, untagged: 0, lastClassifyError: null, classifier: 'claude', tagsFileError: null, lastRecommendError: null, recommendations: {} });
  assert.deepEqual((await get()).body.categories, ['국밥', '돈까스']);
  assert.equal((await health()).untagged, 1);
  fixture.tick(10 * MINUTE);
  await get();
  assert.equal(attempts, 1);
  first.reject(new Error('가짜 실패'));
  await setImmediate();
  assert.equal((await health()).lastClassifyError, '가짜 실패');
  fixture.tick(50 * MINUTE);
  await get();
  assert.equal(attempts, 1);
  fixture.tick(10 * MINUTE);
  await get();
  await setImmediate();
  assert.equal(attempts, 2);
  assert.deepEqual(await health(), {
    ok: true, untagged: 0, lastClassifyError: null, classifier: 'claude', tagsFileError: null,
    lastRecommendError: null, recommendations: { 검암: { key: '2026-11-26|rain', source: 'rule', attempts: 0, error: null } },
  });
  assert.deepEqual((await get()).body.categories, ['국밥', '돈까스', '마라탕']);
});

test('빈 분류 결과는 실패로 기록하고 한 시간 동안 재호출하지 않는다', async () => {
  const prompts = [];
  const fixture = createFixture({ classify: (prompt) => { prompts.push(prompt); return '{}'; } });
  const get = () => fixture.request('/recommend?region=검암');
  await get();
  await setImmediate();
  assert.match((await fixture.request('/health')).body.lastClassifyError, /유효한 업종 분류 결과 없음/);
  fixture.tick(10 * MINUTE);
  await get();
  await setImmediate();
  assert.equal(prompts.length, 1);
  fixture.tick(50 * MINUTE);
  await get();
  await setImmediate();
  assert.equal(prompts.length, 2);
});

test('부분 분류는 저장하고 누락 업종만 한 시간 뒤 다시 보낸다', async () => {
  const prompts = [];
  const fixture = createFixture({
    csv: CSV + '\n다섯째,냉면,검암\n여섯째,수제비,검암',
    classify: (prompt) => {
      prompts.push(prompt);
      return '{"마라탕":["warm_soup"],"냉면":"cold"}';
    },
  });
  const get = () => fixture.request('/recommend?region=검암');
  await get();
  await setImmediate();
  assert.deepEqual((await get()).body.categories, ['국밥', '돈까스', '마라탕']);
  assert.equal((await fixture.request('/health')).body.untagged, 2);
  fixture.tick(10 * MINUTE);
  await get();
  await setImmediate();
  assert.equal(prompts.length, 1);
  fixture.tick(50 * MINUTE);
  await get();
  await setImmediate();
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /업종: \["냉면","수제비"\]$/);
});

test('21자 업종을 제외하고 한 번만 경고하며 분류를 끄면 호출하지 않는다', async () => {
  const warnings = [];
  const prompts = [];
  const category = '가'.repeat(21);
  const options = {
    csv: CSV + '\n다섯째,' + category + ',검암',
    classify: (prompt) => { prompts.push(prompt); return '{"마라탕":[]}'; },
    logger: { warn: (warning) => warnings.push(warning) },
  };
  const fixture = createFixture(options);
  await fixture.request('/recommend?region=검암');
  await setImmediate();
  fixture.tick(10 * MINUTE);
  await fixture.request('/recommend?region=검암');
  await setImmediate();
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /업종 이름 20자 초과/);
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /업종: \["마라탕"\]$/);

  const off = createFixture({ ...options, classifier: 'off' });
  await off.request('/recommend?region=검암');
  await setImmediate();
  assert.equal(prompts.length, 1);
});

test('알 수 없는 경로는 404, 핸들러 예외는 한 요청에만 500을 반환한다', async () => {
  let attempts = 0;
  const errors = [];
  const fixture = createFixture({
    tagStore: { read: async () => {
      if (++attempts === 1) throw new Error('일시 오류');
      return {};
    } },
    logger: { error: (error) => errors.push(error.message) },
  });
  assert.deepEqual((await fixture.request('/foo')).body, { ok: false, reason: 'not-found' });
  assert.equal((await fixture.request('/foo')).status, 404);
  const failure = await fixture.request('/health');
  assert.equal(failure.status, 500);
  assert.deepEqual(failure.body, { ok: false, reason: 'internal-error' });
  assert.equal((await fixture.request('/health')).status, 200);
  assert.deepEqual(errors, ['일시 오류']);
});

test('모르는 지역 로그의 제어문자와 길이를 제한하고 10분간 중복을 막는다', async () => {
  const warnings = [];
  const fixture = createFixture({ logger: { warn: (warning) => warnings.push(warning) } });
  const request = () => fixture.request('/recommend?region=' + '가\n\u0085' + '나'.repeat(50));
  await request();
  fixture.tick(10 * MINUTE - 1);
  await request();
  const expected = '좌표 없음: 가  ' + '나'.repeat(37);
  assert.deepEqual(warnings, [expected]);
  fixture.tick(1);
  await request();
  assert.deepEqual(warnings, [expected, expected]);
});

test('서울 자정이 지나면 TTL 안의 어제 날씨도 반환하지 않는다', async () => {
  const fixture = createFixture({ start: '2026-11-26T14:59:00Z' });
  const get = () => fixture.request('/recommend?region=검암');
  assert.equal((await get()).status, 200);
  fixture.tick(MINUTE);
  fixture.failures.add('weather');
  assert.deepEqual((await get()).body, { ok: false, reason: 'weather-unavailable' });
  assert.deepEqual(fixture.requests, ['weather', 'sheet', 'weather']);
});

test('모르는 지역은 최근 200개 경고만 기억한다', async () => {
  const warnings = [];
  const fixture = createFixture({ logger: { warn: (warning) => warnings.push(warning) } });
  for (let index = 0; index <= 200; index += 1) {
    assert.equal((await fixture.request('/recommend?region=가짜' + index)).status, 404);
  }
  await fixture.request('/recommend?region=가짜1');
  assert.equal(warnings.length, 201);
  await fixture.request('/recommend?region=가짜0');
  assert.equal(warnings.length, 202);
  assert.equal(warnings.at(-1), '좌표 없음: 가짜0');
});

test('기본 추천은 백그라운드 작업 하나만 시작하고 같은 날씨에서는 AI 결과를 재사용한다', async () => {
  const pending = Promise.withResolvers();
  const prompts = [];
  const fixture = createFixture({
    classifier: 'off', recommender: {}, classify: (prompt) => {
      prompts.push(prompt);
      return pending.promise;
    },
  });
  const url = '/recommend?region=검암';
  const results = await Promise.all(Array.from({ length: 12 }, () => fixture.request(url)));
  assert.equal(prompts.length, 1);
  assert.ok(results.every(({ body }) => body.source === 'rule'));
  pending.resolve('{"categories":["없는업종","돈까스","국밥"],"message":"뜨끈한 국밥 어때?"}');
  await setImmediate();
  const { body } = await fixture.request(url);
  assert.equal(body.source, 'ai');
  assert.equal(body.message, '뜨끈한 국밥 어때?');
  assert.equal(body.weather.badge, '☔ 오늘 비');
  assert.deepEqual(body.categories, ['국밥', '돈까스']);

  fixture.setWeather({ apparent_temperature: [11] });
  fixture.tick(30 * MINUTE);
  await fixture.request(url);
  await setImmediate();
  assert.equal((await fixture.request(url)).body.source, 'ai');
  assert.equal(prompts.length, 1);
  const health = (await fixture.request('/health')).body;
  assert.equal(health.lastRecommendError, null);
  assert.deepEqual(health.recommendations, { 검암: { key: '2026-11-26|rain', source: 'ai', attempts: 1, error: null } });
});

test('날씨 분류가 바뀌거나 서울 자정을 넘기면 새 키로 작업한다', async () => {
  let calls = 0;
  const fixture = createFixture({
    classifier: 'off', recommender: {}, start: '2026-11-26T14:00:00Z',
    classify: () => { calls += 1; return '{"categories":["돈까스"]}'; },
  });
  const get = () => fixture.request('/recommend?region=검암');
  await get();
  await setImmediate();
  fixture.setWeather({ precipitation_probability: [0] });
  fixture.tick(30 * MINUTE);
  await get();
  await setImmediate();
  assert.equal((await get()).body.source, 'rule');
  await setImmediate();
  assert.equal((await get()).body.source, 'ai');
  assert.equal(calls, 2);
  fixture.tick(30 * MINUTE);
  assert.deepEqual((await fixture.request('/health')).body.recommendations, {});
  assert.equal((await get()).body.source, 'rule');
  await setImmediate();
  assert.equal((await get()).body.source, 'ai');
  assert.equal(calls, 3);
  assert.equal((await fixture.request('/health')).body.recommendations.검암.key, '2026-11-27|mild');
});

test('추천 실패는 30분 간격으로 같은 키에 하루 세 번까지만 시도한다', async () => {
  let calls = 0;
  const fixture = createFixture({
    classifier: 'off', recommender: {}, classify: () => { calls += 1; throw new Error('실패'.repeat(100)); },
  });
  const get = async () => {
    assert.equal((await fixture.request('/recommend?region=검암')).body.source, 'rule');
    await setImmediate();
  };
  await get();
  fixture.tick(30 * MINUTE - 1);
  await get();
  assert.equal(calls, 1);
  fixture.tick(1);
  await get();
  assert.equal(calls, 2);
  fixture.tick(30 * MINUTE);
  await get();
  assert.equal(calls, 3);
  fixture.tick(60 * MINUTE);
  await get();
  assert.equal(calls, 3);
  const health = (await fixture.request('/health')).body;
  assert.equal(health.lastRecommendError.length, 120);
  assert.deepEqual(health.recommendations.검암, { key: '2026-11-26|rain', source: 'rule', attempts: 3, error: '실패'.repeat(60) });
});

test('시작 미리 돌리기와 요청 및 태그 분류가 겹쳐도 CLI 작업은 직렬이다', async () => {
  const calls = [];
  let active = 0;
  const fixture = createFixture({
    recommender: {}, classify: async (prompt) => {
      const deferred = Promise.withResolvers();
      const type = prompt.startsWith('너는 점심 메뉴 업종 분류기') ? 'tags' : 'pick';
      calls.push({ ...deferred, type });
      assert.equal(++active, 1);
      try {
        return await deferred.promise;
      } finally {
        active -= 1;
      }
    },
  });
  fixture.warmUp();
  const result = await fixture.request('/recommend?region=검암');
  assert.equal(result.body.source, 'rule');
  await setImmediate();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(calls.length, i + 1);
    calls[i].resolve(calls[i].type === 'tags'
      ? '{"마라탕":["warm_soup"]}' : '{"categories":["국밥","쌀국수"]}');
    await setImmediate();
  }
  assert.deepEqual(calls.map(({ type }) => type).sort(), ['pick', 'pick', 'tags']);
  assert.equal(active, 0);
  assert.equal((await fixture.request('/recommend?region=을지로')).body.source, 'ai');
});

test('시트에서 사라진 업종을 걸러내고 전부 사라지면 새 추천을 시작한다', async () => {
  let calls = 0;
  const fixture = createFixture({
    classifier: 'off', recommender: {}, classify: () => ++calls === 1
      ? '{"categories":["국밥","돈까스"],"message":""}' : '{"categories":["마라탕"]}',
  });
  const get = async () => (await fixture.request('/recommend?region=검암')).body;
  await get();
  await setImmediate();
  fixture.setCsv(CSV.split('\n').filter((line) => !line.includes('국밥')).join('\n'));
  fixture.tick(10 * MINUTE);
  await get();
  await setImmediate();
  const partial = await get();
  assert.deepEqual(partial.categories, ['돈까스']);
  assert.equal(partial.message, '비 오는 날엔 국물이나 튀김 어때요?');
  assert.equal(calls, 1);
  fixture.setCsv(CSV.split('\n').filter((line) => !/국밥|돈까스/.test(line)).join('\n'));
  fixture.tick(10 * MINUTE);
  await get();
  await setImmediate();
  assert.equal((await get()).source, 'rule');
  await setImmediate();
  assert.deepEqual((await get()).categories, ['마라탕']);
  assert.equal(calls, 2);
});

test('추천을 끄면 워밍업과 요청에서 추천 CLI를 호출하지 않는다', async () => {
  let calls = 0;
  const fixture = createFixture({ classifier: 'off', classify: () => { calls += 1; } });
  fixture.warmUp();
  assert.deepEqual(fixture.requests, []);
  assert.equal((await fixture.request('/recommend?region=검암')).body.source, 'rule');
  await setImmediate();
  assert.equal(calls, 0);
});

test('시작할 때 날씨 조회에 실패하면 조용히 넘기고 이후 요청에서 AI 추천을 준비한다', async () => {
  let calls = 0;
  const fixture = createFixture({
    classifier: 'off', recommender: {}, classify: () => { calls += 1; return '{"categories":["국밥"]}'; },
  });
  fixture.failures.add('weather');
  fixture.warmUp();
  await setImmediate();
  assert.equal(calls, 0);
  fixture.failures.clear();
  fixture.tick(5 * MINUTE);
  assert.equal((await fixture.request('/recommend?region=검암')).body.source, 'rule');
  await setImmediate();
  assert.equal(calls, 1);
  assert.equal((await fixture.request('/recommend?region=검암')).body.source, 'ai');
});

test('안전장치로 전부 제외되면 규칙으로 답하고 성공한 재시도는 오류를 지운다', async () => {
  const tags = { 냉면: ['cold'], 국밥: ['warm_soup'] };
  let calls = 0;
  const fixture = createFixture({
    recommender: {}, classifier: 'off', csv: CSV + '\n다섯째,냉면,검암',
    tagStore: { read: async () => tags },
    classify: () => ++calls === 1 ? '{"categories":["냉면"]}' : '{"categories":["국밥"]}',
  });
  const get = async () => (await fixture.request('/recommend?region=검암')).body;
  await get();
  await setImmediate();
  assert.deepEqual((await get()).categories, ['국밥']);
  assert.equal((await get()).source, 'rule');
  assert.match((await fixture.request('/health')).body.lastRecommendError, /날씨에 맞는 추천 업종 없음/);
  fixture.tick(30 * MINUTE);
  await get();
  await setImmediate();
  assert.equal((await get()).source, 'ai');
  assert.equal((await fixture.request('/health')).body.lastRecommendError, null);
});

test('지역에 보낼 업종이 없으면 추천 작업을 시작하지 않는다', async () => {
  let calls = 0;
  const fixture = createFixture({
    classifier: 'off', recommender: {},
    csv: '가게명,업종,지역\n첫째,' + '면'.repeat(21) + ',검암',
    classify: () => { calls += 1; },
  });
  assert.equal((await fixture.request('/recommend?region=검암')).body.source, 'rule');
  await setImmediate();
  assert.equal(calls, 0);
});

test('설명문이 붙은 업종 분류 결과도 JSON 객체에서 태그를 반영한다', async () => {
  const fixture = createFixture({ classify: () => '여기 있어:\n{"마라탕":["warm_soup"]}\n끝' });
  await fixture.request('/recommend?region=검암');
  await setImmediate();
  assert.equal((await fixture.request('/health')).body.untagged, 0);
});
