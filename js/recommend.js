const updatedAtFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function buildRecommendUrl(base, region) {
  return `${base}/recommend?region=${encodeURIComponent(region)}`;
}

export function parseRecommendation(json) {
  if (json?.ok !== true) return null;
  const { region, categories, weather, message, updatedAt } = json;
  if (typeof region !== 'string'
    || !Array.isArray(categories) || !categories.every((category) => typeof category === 'string')
    || typeof weather?.badge !== 'string' || typeof message !== 'string'
    || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) return null;
  return { region, categories: [...categories], badge: weather.badge, message, updatedAt };
}

export async function fetchRecommendation(url, fetchFn = fetch, { timeout = 3000 } = {}) {
  const controller = new AbortController();
  let timer;
  try {
    const deadline = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(null);
        controller.abort();
      }, timeout);
    });
    const request = (async () => {
      const response = await fetchFn(url, { signal: controller.signal });
      return response.ok ? parseRecommendation(await response.json()) : null;
    })();
    return await Promise.race([request, deadline]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function pickVisibleCategories(recommended, visible) {
  const categories = new Set(recommended);
  return visible.filter((category) => categories.has(category));
}

export function formatUpdatedAt(iso) {
  return updatedAtFormatter.format(new Date(iso));
}

export function formatRecommendationAnnouncement(message, appliedCount) {
  const summary = `AI 메뉴 추천: ${message}`;
  return appliedCount === null ? summary : `${summary} 업종 ${appliedCount}개를 켰어요`;
}
