// 그룹·업종·오늘 요일로 후보를 고르고 1·2·3순위를 뽑는다.

/** @typedef {import('./stores.js').Store} Store */

const byKorean = (a, b) => a.localeCompare(b, 'ko');

/**
 * group이 null이면 전체 그룹. 그룹이 빈 가게는 전체에도 넣지 않는다.
 * @param {Store} store
 * @param {string | null} group
 */
const inGroup = (store, group) =>
  group === null ? store.groups.length > 0 : store.groups.includes(group);

/**
 * @param {Store[]} stores
 * @returns {string[]}
 */
export function listGroups(stores) {
  return [...new Set(stores.flatMap((s) => s.groups))].sort(byKorean);
}

/**
 * @param {Store[]} stores
 * @param {string | null} group null이면 전체
 * @returns {string[]}
 */
export function listCategories(stores, group) {
  const members = stores.filter((s) => inGroup(s, group));
  return [...new Set(members.flatMap((s) => s.categories))].sort(byKorean);
}

/**
 * 업종은 하나라도 겹치면 통과(OR), 빈 배열이면 필터 없음.
 * @param {Store[]} stores
 * @param {{ group: string | null, categories: string[], day: number }} opts
 * @returns {Store[]}
 */
export function filterCandidates(stores, { group, categories, day }) {
  return stores.filter(
    (s) =>
      inGroup(s, group) &&
      s.enabled &&
      !s.closedDays.includes(day) &&
      (categories.length === 0 || s.categories.some((c) => categories.includes(c))),
  );
}

/**
 * @param {Store[]} stores
 * @param {string | null} group null이면 전체
 * @param {number} day
 * @returns {Store[]}
 */
export function closedToday(stores, group, day) {
  return stores.filter((s) => inGroup(s, group) && s.enabled && s.closedDays.includes(day));
}

/**
 * Fisher–Yates 셔플 후 앞에서 count개. 입력 배열은 바꾸지 않는다.
 * @param {Store[]} candidates
 * @param {number} [count]
 * @param {() => number} [rng]
 * @returns {Store[]}
 */
export function pickTop(candidates, count = 3, rng = Math.random) {
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
