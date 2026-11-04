// 기기에 저장한 제외 기록의 만료와 후보 대체를 다룬다.
export const EXCLUDE_KEY = 'lunch-selector:excluded';
export const EXCLUDE_DAYS = 7;
const DAY_MS = 86400000;

/** 깨진 값·미래 시각·기간이 지난 항목을 버린다. 입력은 변경하지 않는다. */
export function readExcluded(raw, now) {
  let value;
  try { value = JSON.parse(raw); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, at]) =>
    Number.isFinite(at) && at <= now && now - at < EXCLUDE_DAYS * DAY_MS));
}

/** 기존 조건의 후보에서 제외를 뺀다. 남는 후보가 없을 때만 원본으로 대체한다. */
export function withoutExcluded(candidates, excluded, keyOf) {
  const left = candidates.filter((store) => !Object.hasOwn(excluded, keyOf(store)));
  const fallback = candidates.length > 0 && left.length === 0;
  return { list: fallback ? candidates : left, fallback };
}
