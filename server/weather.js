import { createCache } from './cache.js';

const TIMEZONE = 'Asia/Seoul';
const METRICS = {
  temperature: 'apparent_temperature',
  probability: 'precipitation_probability',
  precipitation: 'precipitation',
  code: 'weather_code',
};
const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function buildWeatherUrl({ lat, lon }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: Object.values(METRICS).join(','),
    timezone: TIMEZONE,
    forecast_days: '1',
  });
  return url;
}

export function parseLunchWeather({ hourly }, date, lunchHours) {
  const day = dateFormatter.format(date);
  return lunchHours.map((hour) => {
    const time = `${day}T${String(hour).padStart(2, '0')}:00`;
    const index = hourly?.time?.indexOf(time) ?? -1;
    if (index < 0) {
      throw new Error('점심시간 날씨 데이터 누락');
    }
    return Object.fromEntries(Object.entries(METRICS).map(([key, field]) => {
      const value = hourly[field]?.[index];
      return [key, Number.isFinite(value) ? value : null];
    }));
  });
}

export function createWeatherCache({ regions, lunchHours, fetchFn, now }) {
  return createCache(async (region) => {
    const response = await fetchFn(buildWeatherUrl(regions[region]), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`날씨 요청 실패: HTTP ${response.status}`);
    return parseLunchWeather(await response.json(), now(), lunchHours);
  }, {
    now,
    ttl: 30 * 60 * 1000,
    isCurrent: (receivedAt, time) => dateFormatter.format(receivedAt) === dateFormatter.format(time),
  });
}
