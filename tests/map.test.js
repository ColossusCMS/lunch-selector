import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kakaoLink, cachedLookup, coreAddress, createSdkLoader } from '../js/map.js';

test('kakaoLink: 좌표가 있으면 그 위치를 핀으로 연다', () => {
  assert.equal(
    kakaoLink('본죽', { lat: 37.5, lng: 126.9 }),
    `https://map.kakao.com/link/map/${encodeURIComponent('본죽')},37.5,126.9`,
  );
});

test('kakaoLink: 좌표가 없으면 가게명으로 검색한다', () => {
  assert.equal(kakaoLink('본죽', null), `https://map.kakao.com/link/search/${encodeURIComponent('본죽')}`);
});

test('kakaoLink: 이름의 쉼표는 좌표 구분자와 헷갈리지 않게 뺀다', () => {
  assert.equal(
    kakaoLink('김밥,천국', { lat: 1, lng: 2 }),
    `https://map.kakao.com/link/map/${encodeURIComponent('김밥 천국')},1,2`,
  );
});

test('cachedLookup: 같은 주소는 한 번만 묻는다', async () => {
  let calls = 0;
  const locate = cachedLookup(async () => { calls += 1; return { lat: 1, lng: 2 }; });
  assert.deepEqual(await locate('서울 중구'), { lat: 1, lng: 2 });
  assert.deepEqual(await locate(' 서울 중구 '), { lat: 1, lng: 2 });
  assert.equal(calls, 1);
});

test('cachedLookup: 빈 주소는 묻지 않고 null', async () => {
  let calls = 0;
  const locate = cachedLookup(async () => { calls += 1; return { lat: 1, lng: 2 }; });
  assert.equal(await locate(''), null);
  assert.equal(await locate('  '), null);
  assert.equal(calls, 0);
});

test('cachedLookup: 조회가 실패하면 null이고 다음에 다시 묻는다', async () => {
  let calls = 0;
  const locate = cachedLookup(async () => { calls += 1; throw new Error('network'); });
  assert.equal(await locate('서울'), null);
  assert.equal(await locate('서울'), null);
  assert.equal(calls, 2);
});

test('coreAddress: 도로명 주소는 건물 번호까지만 남긴다', () => {
  assert.equal(coreAddress('인천 서해구 승학로 508 1-2층 104~105,201호'), '인천 서해구 승학로 508');
  assert.equal(coreAddress('인천 서해구 검암로 21 1~2층'), '인천 서해구 검암로 21');
  assert.equal(coreAddress('인천 서해구 검암로30번길 10 106, 107호 금복돈육식당'), '인천 서해구 검암로30번길 10');
  assert.equal(coreAddress('서울 강남구 테헤란로 123-4 2층'), '서울 강남구 테헤란로 123-4');
});

test('coreAddress: 지번 주소는 번지까지만 남긴다', () => {
  assert.equal(coreAddress('인천 서구 검암동 123-4 2층'), '인천 서구 검암동 123-4');
});

test('coreAddress: 더 줄일 수 없으면 null', () => {
  assert.equal(coreAddress('인천 서해구 승학로 508'), null);
  assert.equal(coreAddress('아무거나'), null);
});

function sdkEnvironment() {
  const scripts = [], timers = new Map(), callbacks = [];
  let timerId = 0, loads = 0;
  const kakao = { maps: { load(callback) { loads += 1; callbacks.push(callback); } } };
  const document = {
    head: { append(script) { scripts.push(script); } },
    createElement(tag) {
      assert.equal(tag, 'script');
      return { remove() { const i = scripts.indexOf(this); if (i !== -1) scripts.splice(i, 1); } };
    },
  };
  const load = createSdkLoader({ document, getKakao: () => kakao,
    setTimer(fn, ms) { assert.equal(ms, 8000); timers.set(++timerId, fn); return timerId; },
    clearTimer(id) { timers.delete(id); } });
  return { load, scripts, timers, callbacks, kakao, loads: () => loads,
    expire() { [...timers.values()][0](); } };
}

test('SDK 타임아웃은 script를 제거하고 재시도 시 하나만 삽입, 늦은 onload 무시', async () => {
  const env = sdkEnvironment();
  const first = env.load('key');
  const old = env.scripts[0], lateLoad = old.onload;
  const rejected = assert.rejects(first, /응답 없음/);
  env.expire(); await rejected;
  assert.equal(env.scripts.length, 0);
  assert.equal(old.onload, null);
  assert.equal(old.onerror, null);
  const retry = env.load('key');
  assert.equal(env.scripts.length, 1);
  lateLoad(); assert.equal(env.loads(), 0);
  env.scripts[0].onload(); env.callbacks[0]();
  assert.equal(await retry, env.kakao);
  assert.equal(env.timers.size, 0);
});

test('SDK onerror 정리 후 재시도와 동시 요청 공유, 성공 뒤 다시 삽입하지 않음', async () => {
  const env = sdkEnvironment();
  const first = env.load('key');
  assert.equal(env.load('key'), first);
  const rejected = assert.rejects(first, /불러오지 못/);
  env.scripts[0].onerror(); await rejected;
  assert.equal(env.scripts.length, 0);
  assert.equal(env.timers.size, 0);
  const retry = env.load('key');
  assert.equal(env.load('key'), retry);
  env.scripts[0].onload(); env.callbacks[0]();
  assert.equal(await retry, env.kakao);
  assert.equal(await env.load('key'), env.kakao);
  assert.equal(env.scripts.length, 1);
  assert.equal(env.loads(), 1);
});

test('SDK maps.load 대기 중 만료된 콜백은 새 시도를 완료시키지 않음', async () => {
  const env = sdkEnvironment();
  const first = env.load('key');
  env.scripts[0].onload();
  const rejected = assert.rejects(first, /응답 없음/);
  env.expire(); await rejected;
  const retry = env.load('key');
  env.callbacks[0]();
  assert.equal(env.scripts.length, 1);
  assert.equal(env.timers.size, 1);
  env.scripts[0].onload(); env.callbacks[1]();
  assert.equal(await retry, env.kakao);
  assert.equal(env.timers.size, 0);
});
