// 익명 평가의 집계와 마지막 추천 기록을 다룬다.

/** @typedef {{ at: number, mode: string, region: string, names: string[] }} Pick */
/** @typedef {{ avg: number | null, count: number }} RatingStat */

export const PICK_KEY = 'lunch-selector:last-pick';
export const MIN_WAIT_MS = 30 * 60 * 1000;
export const MAX_DAYS = 3;
export const TIER_MIN_COUNT = 2;
export const TIERS = [
  { id: 'diamond', label: '💎 다이아', min: 4.5 },
  { id: 'ruby', label: '❤️ 루비', min: 4.0 },
  { id: 'emerald', label: '💚 에메랄드', min: 3.0 },
  { id: 'stone', label: '🪨 원석', min: -Infinity },
];
export const UNKNOWN_TIER = { id: 'unknown', label: '❔ 미확인' };

export function starLabel(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5
    ? ['별로예요', '아쉬워요', '괜찮아요', '맛있어요', '최고예요'][n - 1] : '';
}

export function ratingModeLabel(label) {
  const match = label.trim().match(/^(\S+)\s+(.+)$/u);
  return match && /\p{Extended_Pictographic}/u.test(match[1])
    ? { icon: match[1], name: match[2].trim() }
    : { icon: '🍽️', name: label.trim() };
}

export function cardTier(stat) {
  if (!stat || stat.count < TIER_MIN_COUNT || stat.avg === null) return UNKNOWN_TIER;
  return TIERS.find((tier) => stat.avg >= tier.min);
}

export function ratingKey(mode, region, name) {
  return JSON.stringify([mode.trim(), region.trim(), name.trim()]);
}

/** @returns {Map<string, RatingStat>} */
export function aggregateRatings(rows) {
  const header = (rows[0] ?? []).map((s) => s.replace(/^\uFEFF/, '').trim());
  const col = Object.fromEntries(['모드', '지역', '가게명', '별점'].map((s) => [s, header.indexOf(s)]));
  const totals = new Map();
  if (col.모드 === -1 || col.가게명 === -1) return totals;
  for (const row of rows.slice(1)) {
    const cell = (key) => (row[col[key]] ?? '').trim();
    const mode = cell('모드');
    const name = cell('가게명');
    if (!mode || !name) continue;
    const key = ratingKey(mode, cell('지역'), name);
    const total = totals.get(key) ?? { sum: 0, count: 0 };
    if (/^[1-5]$/.test(cell('별점'))) {
      total.sum += Number(cell('별점'));
      total.count += 1;
    }
    totals.set(key, total);
  }
  return new Map([...totals].map(([key, t]) => [key, {
    count: t.count,
    avg: t.count ? Math.round(t.sum / t.count * 10) / 10 : null,
  }]));
}

export function formatStatLine(stat, tierId, size) {
  if (tierId === 'unknown') {
    return { text: size === 'small' ? '평가 부족' : '아직 평가가 부족해요', label: '아직 평가가 부족해요' };
  }
  return stat?.avg != null
    ? { text: `★${stat.avg.toFixed(1)}`, label: `평균 별점 ${stat.avg.toFixed(1)}점` }
    : { text: '', label: '' };
}

/** @returns {Pick | null} */
export function parsePick(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || !Number.isFinite(p.at) || !Number.isFinite(new Date(p.at).getTime())
      || typeof p.mode !== 'string' || !p.mode.trim()
      || typeof p.region !== 'string'
      || !Array.isArray(p.names) || p.names.length < 1 || p.names.length > 3
      || !p.names.every((n) => typeof n === 'string' && n.trim())) return null;
    return { at: p.at, mode: p.mode, region: p.region, names: p.names };
  } catch {
    return null;
  }
}

export function pickStatus(pick, now, modeIds) {
  if (!modeIds.includes(pick.mode)) return 'drop';
  const midnight = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((midnight(now) - midnight(pick.at)) / 86400000);
  if (days < 0 || days > MAX_DAYS) return 'drop';
  if (now - pick.at < MIN_WAIT_MS) return 'wait';
  return 'ask';
}

export function buildRatingBody(entries, rating) {
  return new URLSearchParams({
    [entries.mode]: rating.mode,
    [entries.region]: rating.region,
    [entries.name]: rating.name,
    [entries.stars]: rating.stars === null ? '' : String(rating.stars),
  });
}

export function applySendResults(saved, cardAt, sent, failed) {
  if (!saved || saved.at !== cardAt) return saved;
  const names = saved.names.filter((name) => failed.includes(name) && !sent.includes(name));
  return names.length ? { ...saved, names } : null;
}

export function dropIfSame(saved, cardAt) {
  return saved?.at === cardAt ? null : saved;
}
