import assert from 'node:assert/strict';
import test from 'node:test';
import { createPickJobs } from '../server/pick-jobs.js';

const wet = { conditions: ['rain'], badge: '☔ 오늘 비' };
const mild = { conditions: [], badge: '' };
const lunch = new Set(['국밥']);

function fixture(classify) {
  const queue = [];
  let time = Date.parse('2026-11-26T14:59:00Z');
  const jobs = createPickJobs({
    recommender: 'claude', now: () => time, enqueue: (task) => queue.push(task),
    classify, tagStore: { read: async () => ({}) },
  });
  return { ...jobs, queue, tick: (ms) => { time += ms; } };
}

test('대기 중 지역의 최신 키가 바뀌면 옛 작업을 호출하거나 시도 횟수에 넣지 않는다', async () => {
  const prompts = [];
  const jobs = fixture((prompt) => { prompts.push(prompt); return '{"categories":["국밥"]}'; });
  jobs.choose('검암', wet, lunch);
  jobs.choose('검암', mild, lunch);
  await jobs.queue.shift()();
  assert.equal(prompts.length, 0);
  await jobs.queue.shift()();
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /날씨: 무난/);
  jobs.choose('검암', wet, lunch);
  assert.equal(jobs.health().recommendations.검암.attempts, 0);
  await jobs.queue.shift()();
  assert.equal(prompts.length, 2);
});

test('지역별 오류를 보존하고 최신 오류를 노출하며 서울 자정에 함께 지운다', async () => {
  const jobs = fixture((prompt) => {
    if (prompt.includes('을지로') && prompt.includes('날씨: 무난')) return '{"categories":["국밥"]}';
    throw new Error(prompt.includes('검암') ? '검암 실패' : '을지로 실패');
  });
  jobs.choose('검암', wet, lunch);
  jobs.choose('을지로', wet, lunch);
  await jobs.queue.shift()();
  await jobs.queue.shift()();
  assert.equal(jobs.health().lastRecommendError, '을지로 실패');
  assert.equal(jobs.health().recommendations.검암.error, '검암 실패');
  assert.equal(jobs.health().recommendations.을지로.error, '을지로 실패');
  jobs.choose('을지로', mild, lunch);
  await jobs.queue.shift()();
  assert.equal(jobs.health().lastRecommendError, '검암 실패');
  assert.equal(jobs.health().recommendations.을지로.error, null);
  jobs.tick(60_000);
  assert.deepEqual(jobs.health(), { lastRecommendError: null, recommendations: {} });
});

test('마지막 평가의 지역 업종과 작업 결과가 겹치지 않으면 상태에 rule을 표시한다', async () => {
  const jobs = fixture(() => '{"categories":["국밥"]}');
  jobs.choose('검암', wet, lunch);
  jobs.choose('검암', wet, new Set(['메밀']));
  await jobs.queue.shift()();
  assert.equal(jobs.health().recommendations.검암.source, 'rule');
  assert.equal(jobs.choose('검암', wet, new Set(['메밀'])), null);
});
