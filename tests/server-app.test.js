import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { createHandler } from '../server/app.js';

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
  csv = CSV, tagStore, start = '2026-11-26T01:00:00Z',
} = {}) {
  let time = Date.parse(start);
  let tags = { 국밥: ['warm_soup'], 돈까스: ['greasy'], 쌀국수: ['warm_soup'] };
  const failures = new Set();
  const requests = [];
  const handler = createHandler({
    config: {
      allowedOrigins: ['https://colossuscms.github.io'],
      regions: { 검암: { lat: 37, lon: 126 }, 을지로: { lat: 38, lon: 127 } },
      lunchHours: [11], sheetCsvUrl: SHEET_URL, classifier,
    },
    now: () => time,
    fetchFn: async (url) => {
      const source = url === SHEET_URL ? 'sheet' : 'weather';
      requests.push(source);
      if (failures.has(source)) return new Response('', { status: 503 });
      if (source === 'sheet') return new Response(csv);
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(time);
      return Response.json({ hourly: { ...rain.hourly, time: [day + 'T11:00'] } });
    },
    tagStore: tagStore ?? {
      read: async () => tags,
      merge: async (additions) => { tags = { ...tags, ...additions }; },
    },
    classify,
    logger,
  });

  return {
    requests, failures,
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

  assert.deepEqual(await health(), { ok: true, untagged: 0, lastClassifyError: null, classifier: 'claude', tagsFileError: null });
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
  assert.deepEqual(await health(), { ok: true, untagged: 0, lastClassifyError: null, classifier: 'claude', tagsFileError: null });
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
