// 지역·그룹·업종·오늘 요일로 후보를 고른다.
/** @typedef {import('./stores.js?v=202611041325').Store} Store */
const byKorean = (a, b) => a.localeCompare(b, 'ko');
const inGroup = (store, group) => group === null || store.groups.includes(group);
const members = (stores, region, group = null) => stores.filter((s) => s.region === region && inGroup(s, group));
/** 이름 없는 하위 호환 지역('')도 하나의 지역으로 센다. */
export const listRegions = (stores) => [...new Set(stores.map((s) => s.region))].sort(byKorean);
export const listGroups = (stores, region) => [...new Set(members(stores, region).flatMap((s) => s.groups))].sort(byKorean);
export const listCategories = (stores, region, group) => [...new Set(members(stores, region, group).flatMap((s) => s.categories))].sort(byKorean);
export function filterCandidates(stores, { region, group, categories, day }) {
  return members(stores, region, group).filter((s) => !s.closedDays.includes(day)
    && (categories.length === 0 || s.categories.some((c) => categories.includes(c))));
}
export const closedToday = (stores, region, group, day) => members(stores, region, group).filter((s) => s.closedDays.includes(day));

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
