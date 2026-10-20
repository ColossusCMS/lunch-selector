import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kakaoLink, cachedLookup } from '../js/map.js';

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
