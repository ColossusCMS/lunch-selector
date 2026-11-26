const RAIN_PROBABILITY = 60;
const COLD_LIMIT = 5;
const HOT_LIMIT = 28;
const SNOW_CODES = [[71, 77], [85, 86]];
const WET_CODES = [[51, 67], [71, 77], [80, 86], [95, 99]];

const RULES = {
  rain: { tags: ['warm_soup', 'greasy'], badge: '☔ 오늘 비', message: '비 오는 날엔 국물이나 튀김 어때요?' },
  hot: { tags: ['cold', 'light'], badge: '🥵 오늘 더움', message: '더우니까 시원하고 가볍게 드셔 보세요' },
  cold: { tags: ['warm_soup'], badge: '🥶 오늘 쌀쌀', message: '쌀쌀하니까 뜨끈한 국물 어때요?' },
};

const matchesCode = (samples, ranges) => samples.some(({ code }) =>
  ranges.some(([min, max]) => code >= min && code <= max));

function summarize(samples, key, aggregate) {
  const values = samples.map((sample) => sample[key]).filter(Number.isFinite);
  return values.length ? aggregate(...values) : null;
}

export function evaluateWeather(samples) {
  const apparentMin = summarize(samples, 'temperature', Math.min);
  const apparentMax = summarize(samples, 'temperature', Math.max);
  const precipitationProbabilityMax = summarize(samples, 'probability', Math.max);
  const active = {
    rain: precipitationProbabilityMax >= RAIN_PROBABILITY
      || samples.some(({ precipitation }) => precipitation > 0)
      || matchesCode(samples, WET_CODES),
    hot: apparentMax >= HOT_LIMIT,
    cold: apparentMin !== null && apparentMin <= COLD_LIMIT,
  };
  const conditions = Object.keys(RULES).filter((condition) => active[condition]);
  const primary = RULES[conditions[0]];
  const badge = active.rain && matchesCode(samples, SNOW_CODES)
    ? '❄️ 오늘 눈' : primary?.badge ?? '';
  return {
    weather: { conditions, badge, apparentMin, apparentMax, precipitationProbabilityMax },
    message: primary?.message ?? '오늘은 날씨 무난해요. 자유롭게 골라보세요',
    tags: new Set(conditions.flatMap((condition) => RULES[condition].tags)),
  };
}
