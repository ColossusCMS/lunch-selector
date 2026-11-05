// 샘플의 1.0배속 시간과 등급 표현을 한곳에서 관리한다.
export const REVEAL_TIME = Object.freeze({
  direct: 2900, roulette: 2500, dissolve: 750, charge: 1100,
  category: 1250, categoryOut: 350, beforeCard: 180,
  core: 1050, categoryIn: 650, gradeIn: 700, gradeOut: 300,
  beam: 600, flash: 850, shake: 350, card: 1050, ripple: 1400,
  closeGuard: 500, summary: 500, autoClose: 5000,
  shortFadeAt: 1700, shortDissolve: 600, questionIn: 300, questionHold: 400,
});
const GRADES = {
  stone: { name: '원석', en: 'STONE', color: '#c6baa5', rgb: '198,186,165', duration: 0, power: .3 },
  emerald: { name: '에메랄드', en: 'EMERALD', color: '#75ecc0', rgb: '117,236,192', duration: 1350, power: .8 },
  ruby: { name: '루비', en: 'RUBY', color: '#ff6e95', rgb: '255,110,149', duration: 1900, power: 1.2 },
  diamond: { name: '다이아', en: 'DIAMOND', color: '#bcdeff', rgb: '188,222,255', duration: 2450, power: 1.8 },
};
for (const grade of Object.values(GRADES)) Object.freeze(grade);

/** 연출 창에서 실제로 사용하는 세 보석만 그림을 고른다. */
export function gemKind(tierId) {
  return ['emerald', 'ruby', 'diamond'].includes(tierId) ? tierId : null;
}

/** 자동 닫기와 같은 경과 시간에서 남은 초를 올림한다. */
export function revealSecondsLeft(elapsed) {
  return Math.max(0, Math.ceil((REVEAL_TIME.autoClose - elapsed) / 1000));
}

export function canReplay(tierId, reduce = false) {
  return !reduce && gemKind(tierId) !== null;
}

export function replayPlan(tierId, hasCategory = true) {
  return canReplay(tierId) ? revealPlan(tierId, hasCategory) : null;
}

/** 선택 결과와 독립적인 시작 위치에서 후보 전체를 순환한다. */
export function rouletteRows(names, rng = Math.random) {
  if (!names.length) return [];
  const start = Math.floor(rng() * names.length);
  return Array.from({ length: Math.max(64, names.length) }, (_, i) => names[(start + i) % names.length]);
}

/** 상위 등급 공개/짧은 흐름의 물음표 유지까지. 업종이 없으면 단서 단계를 생략한다. */
export function revealPlan(tierId, hasCategory = true) {
  const long = ['emerald', 'ruby', 'diamond'].includes(tierId);
  const grade = Object.hasOwn(GRADES, tierId) ? GRADES[tierId] : GRADES.stone;
  const fadeAt = long ? REVEAL_TIME.roulette - REVEAL_TIME.dissolve : REVEAL_TIME.shortFadeAt;
  const fadeDuration = long ? REVEAL_TIME.dissolve : REVEAL_TIME.shortDissolve;
  const reelEnd = fadeAt + fadeDuration;
  return {
    long, grade, showGrade: Object.hasOwn(GRADES, tierId),
    overlay: long,
    overlayAt: long ? REVEAL_TIME.roulette - REVEAL_TIME.dissolve : null,
    reelDuration: long ? REVEAL_TIME.roulette : REVEAL_TIME.direct,
    fadeAt, fadeDuration, reelEnd,
    questionIn: long ? 0 : REVEAL_TIME.questionIn,
    hold: long ? 0 : REVEAL_TIME.questionHold,
    duration: long ? REVEAL_TIME.roulette + REVEAL_TIME.charge
      + (hasCategory ? REVEAL_TIME.category + REVEAL_TIME.categoryOut : 0)
      + grade.duration + REVEAL_TIME.beforeCard : reelEnd + REVEAL_TIME.questionIn + REVEAL_TIME.questionHold,
  };
}
