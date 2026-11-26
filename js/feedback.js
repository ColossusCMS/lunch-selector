export const FEEDBACK_FIELDS = [
  'feature', 'result', 'comment', 'region', 'weather', 'categories', 'source', 'store', 'version',
];

const FEEDBACK_STAR_LABELS = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];

/** 피드백 모달의 별 아래 문구. 별점 카드(맛 평가)의 starLabel과 따로 둔다. */
export function feedbackStarLabel(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5 ? FEEDBACK_STAR_LABELS[n - 1] : '';
}

export function buildFeedbackBody(entries, data) {
  const comment = [...(data.comment ?? '').trim()].slice(0, 500).join('');
  return new URLSearchParams(FEEDBACK_FIELDS.map((key) => [
    entries[key], key === 'comment' ? comment : String(data[key] ?? ''),
  ]));
}

export function formatWeatherSummary(weather) {
  if (!weather) return '';
  const { conditions = [], badge = '', apparentMin, apparentMax, precipitationProbabilityMax } = weather;
  const rain = conditions.includes('rain');
  const label = rain ? (badge.includes('눈') ? '눈' : '비')
    : conditions.includes('hot') ? '더움' : conditions.includes('cold') ? '추움' : '무난';
  const temperatures = [...new Set([apparentMin, apparentMax].filter(Number.isFinite))];
  const parts = [label];
  if (temperatures.length) parts.push(`체감 ${temperatures.join('~')}℃`);
  if (Number.isFinite(precipitationProbabilityMax)) parts.push(`강수 ${precipitationProbabilityMax}%`);
  return parts.join(' · ');
}

export function shouldAutoPrompt({ enabled, recommendOn, mode, prompted }) {
  return enabled && recommendOn && mode === 'lunch' && !prompted;
}

export function feedbackContext({ region, recommendation, recommendOn, store, version }) {
  return {
    region: region ?? '',
    weather: formatWeatherSummary(recommendation?.weather),
    categories: recommendation?.categories.join(', ') ?? '',
    source: recommendOn ? recommendation?.source ?? '' : 'off',
    store: store ?? '',
    version,
  };
}
