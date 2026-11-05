import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealPlan, canReplay, replayPlan, rouletteRows, gemKind, revealSecondsLeft, REVEAL_TIME } from '../js/reveal-plan.js';

test('원석·미확인·평가 꺼짐·모르는 등급은 원석의 짧은 흐름', () => {
  for (const id of ['stone', 'unknown', 'none', undefined, null, 'other', 'constructor']) {
    const plan = revealPlan(id);
    assert.equal(plan.long, false);
    assert.equal(plan.overlay, false);
    assert.equal(plan.overlayAt, null);
    assert.equal(plan.reelDuration, 2900);
    assert.equal(plan.hold, 400);
    assert.equal(plan.duration, 3000);
    assert.equal(plan.grade.color, '#c6baa5');
    assert.equal(plan.showGrade, id === 'stone');
  }
});

test('상위 등급의 색·시간은 샘플 1.0배속과 같고 등급 순서대로 길어진다', () => {
  const plans = ['emerald', 'ruby', 'diamond'].map(id => revealPlan(id));
  assert.ok(plans.every(p => p.long && p.showGrade));
  assert.ok(plans.every(p => p.overlay && p.overlayAt === 1750 && p.reelDuration === 2500 && p.hold === 0));
  assert.ok(plans.every(p => p.fadeAt === 1750 && p.fadeDuration === 750 && p.reelEnd === 2500));
  assert.deepEqual(plans.map(p => p.grade.color), ['#75ecc0', '#ff6e95', '#bcdeff']);
  assert.deepEqual(plans.map(p => p.grade.duration), [1350, 1900, 2450]);
  assert.deepEqual(plans.map(p => p.duration), [6730, 7280, 7830]);
});

test('업종이 없으면 상위 등급의 업종 진입·퇴장 시간만 생략', () => {
  for (const id of ['emerald', 'ruby', 'diamond']) {
    assert.equal(revealPlan(id).duration - revealPlan(id, false).duration,
      REVEAL_TIME.category + REVEAL_TIME.categoryOut);
  }
  assert.equal(revealPlan('stone', false).duration, revealPlan('stone').duration);
});

test('보석 그림은 상위 세 등급마다 다르고 원석·미확인·모르는 값은 없다', () => {
  assert.deepEqual(['emerald', 'ruby', 'diamond'].map(gemKind), ['emerald', 'ruby', 'diamond']);
  for (const id of ['stone', 'unknown', 'none', undefined, null, 'other', 'constructor']) {
    assert.equal(gemKind(id), null);
  }
});

test('최종 공개 자동 닫기는 5초, 빠른 닫기 보호는 0.5초', () => {
  assert.equal(REVEAL_TIME.autoClose, 5000);
  assert.equal(REVEAL_TIME.closeGuard, 500);
});

test('자동 닫기와 같은 경과 시각으로 남은 초를 올림하고 만료 후에는 0', () => {
  const elapsed = [0, 999.9, 1000, 1999.9, 2000, 3000, 4000, 4999.9, 5000, 6000];
  assert.deepEqual(elapsed.map(revealSecondsLeft), [5, 5, 4, 4, 3, 2, 1, 1, 0, 0]);
});

test('짧은 흐름은 1700ms부터 600ms 소멸 뒤 2300ms에 물음표 진입·400ms 유지', () => {
  for (const id of ['stone', 'unknown', 'none', 'other']) {
    const plan = revealPlan(id);
    assert.equal(plan.reelDuration, 2900);
    assert.equal(plan.fadeAt, 1700);
    assert.equal(plan.fadeDuration, 600);
    assert.equal(plan.reelEnd, 2300);
    assert.equal(plan.reelEnd, plan.fadeAt + plan.fadeDuration);
    assert.equal(plan.questionIn, 300);
    assert.equal(plan.hold, 400);
    assert.equal(plan.duration, plan.reelEnd + plan.questionIn + plan.hold);
  }
  assert.equal(REVEAL_TIME.questionHold, 400);
});

test('다시보기는 움직임을 줄이지 않는 상위 세 등급에만 허용', () => {
  for (const id of ['emerald', 'ruby', 'diamond']) {
    assert.equal(canReplay(id), true);
    assert.equal(canReplay(id, true), false);
  }
  for (const id of ['stone', 'unknown', 'none', null, undefined, 'other', 'constructor']) {
    assert.equal(canReplay(id), false);
    assert.equal(replayPlan(id), null);
  }
});

test('다시보기의 창 안 룰렛과 등급별 총시간은 019와 동일', () => {
  const plans = ['emerald', 'ruby', 'diamond'].map(id => replayPlan(id));
  assert.ok(plans.every(plan => plan.reelDuration === 2500 && plan.fadeAt === 1750 && plan.reelEnd === 2500));
  assert.deepEqual(plans.map(plan => plan.duration), [6730, 7280, 7830]);
  assert.equal(replayPlan('diamond', false).duration, 6230);
});

test('공유 룰렛 행은 후보 수와 무관하게 전체를 포함하고 시작점만 무작위로 바꾼다', () => {
  for (const count of [1, 2, 5, 6, 80]) {
    const names = Array.from({ length: count }, (_, i) => String(i));
    for (const value of [0, .99]) {
      const rows = rouletteRows(names, () => value);
      assert.equal(rows.length, Math.max(64, count));
      assert.deepEqual([...new Set(rows)].sort(), [...names].sort());
      assert.equal(rows[0], names[Math.floor(value * count)]);
    }
    assert.deepEqual(names, Array.from({ length: count }, (_, i) => String(i)));
  }
  assert.deepEqual(rouletteRows([]), []);
});
