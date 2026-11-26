import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { createCache } from '../server/cache.js';

test('TTL 뒤 즉시 캐시를 반환하고 갱신을 공유하며 실패 후 5분간 재시도하지 않는다', async () => {
  const minute = 60_000;
  let time = 0;
  let loads = 0;
  let next = Promise.resolve('initial');
  const get = createCache(() => { loads += 1; return next; }, { ttl: 10 * minute, now: () => time });
  const initial = await get('region');
  time = 10 * minute;
  const refresh = Promise.withResolvers();
  next = refresh.promise;
  assert.deepEqual(await Promise.all([get('region'), get('region')]), [initial, initial]);
  assert.equal(loads, 2);
  refresh.reject(new Error('장애'));
  await setImmediate();
  time += 5 * minute - 1;
  assert.equal(await get('region'), initial);
  assert.equal(loads, 2);
  time += 1;
  next = Promise.resolve('refreshed');
  assert.equal(await get('region'), initial);
  await setImmediate();
  assert.deepEqual(await get('region'), { value: 'refreshed', receivedAt: time });
  assert.equal(loads, 3);
});

test('캐시가 6시간을 넘으면 갱신을 기다린다', async () => {
  let time = 0;
  let next = Promise.resolve('old');
  const get = createCache(() => next, { ttl: 1, now: () => time });
  await get();
  time = 6 * 60 * 60 * 1000 + 1;
  const refresh = Promise.withResolvers();
  next = refresh.promise;
  let complete = false;
  const result = get().then((value) => { complete = true; return value; });
  await setImmediate();
  assert.equal(complete, false);
  refresh.resolve('fresh');
  assert.deepEqual(await result, { value: 'fresh', receivedAt: time });
});
