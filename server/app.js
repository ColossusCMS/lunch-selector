import { runClaude } from './classifier.js';
import { createPickJobs } from './pick-jobs.js';
import { evaluateWeather } from './rules.js';
import { createSheetCache } from './sheet.js';
import { buildPrompt, findUntagged, validateOutput } from './tags.js';
import { createWeatherCache } from './weather.js';

const RETRY_DELAY = 60 * 60 * 1000;
const REGION_WARNING_LIMIT = 200;

function send(response, status, body) {
  response.writeHead(status);
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

const failure = (reason) => ({ ok: false, reason });

export const createHandler = (deps) => createApp(deps).handler;

export function createApp({
  config, tagStore, now = Date.now, fetchFn = fetch, classify = runClaude, logger = console,
}) {
  const { allowedOrigins, regions, lunchHours, sheetCsvUrl, classifier, recommender = 'claude' } = config;
  let cliQueue = Promise.resolve();
  function enqueue(task) {
    const run = cliQueue.then(task);
    cliQueue = run.catch(() => {});
    return run;
  }
  const picks = createPickJobs({ recommender, now, enqueue, classify, tagStore });
  let knownCategories = new Set();
  let lastClassifyError = null;
  let failedAt = -Infinity;
  let classifying = false;
  const categoryFailures = new Map();
  const oversizedWarnings = new Set();
  const regionWarnings = new Map();

  function warnUnknownRegion(region) {
    const time = now();
    const limit = 10 * 60 * 1000;
    for (const [name, loggedAt] of regionWarnings) {
      if (time - loggedAt < limit) break;
      regionWarnings.delete(name);
    }
    const name = [...region.replace(/\p{Cc}/gu, ' ')].slice(0, 40).join('');
    if (regionWarnings.has(name)) return;
    if (regionWarnings.size >= REGION_WARNING_LIMIT) {
      regionWarnings.delete(regionWarnings.keys().next().value);
    }
    regionWarnings.set(name, time);
    logger.warn(`좌표 없음: ${name}`);
  }

  async function classifyNewCategories() {
    if (classifier !== 'claude' || classifying || now() - failedAt < RETRY_DELAY) return;
    classifying = true;
    try {
      const untagged = findUntagged(knownCategories, await tagStore.read());
      if (tagStore.fileError) return;
      for (const [category, time] of categoryFailures) {
        if (now() - time >= RETRY_DELAY) categoryFailures.delete(category);
      }
      const eligible = untagged.filter((category) => {
        if ([...category].length <= 20) return !categoryFailures.has(category);
        if (!oversizedWarnings.has(category)) {
          oversizedWarnings.add(category);
          logger.warn(`업종 이름 20자 초과: ${JSON.stringify(category)}`);
        }
        return false;
      });
      if (!eligible.length) return;
      await enqueue(async () => {
        const output = await classify(buildPrompt(eligible));
        let tags;
        try {
          tags = validateOutput(output, eligible);
        } catch {
          throw new Error('분류 결과 JSON 형식 오류');
        }
        if (!Object.keys(tags).length) throw new Error('유효한 업종 분류 결과 없음');
        const failedTime = now();
        for (const category of findUntagged(eligible, tags)) {
          categoryFailures.set(category, failedTime);
        }
        await tagStore.merge(tags);
        lastClassifyError = null;
      });
    } catch (error) {
      lastClassifyError = String(error.message ?? error).slice(0, 120);
      failedAt = now();
    } finally {
      classifying = false;
    }
  }

  const getWeather = createWeatherCache({ regions, lunchHours, fetchFn, now });
  const getSheet = createSheetCache({
    sheetCsvUrl, fetchFn, now,
    onRefresh({ all }) {
      knownCategories = all;
      void classifyNewCategories();
    },
  });

  async function recommend(region) {
    const tagsAtRequest = await tagStore.read();
    const [weatherResult, sheetResult] = await Promise.allSettled([getWeather(region), getSheet()]);
    if (weatherResult.status === 'rejected') return failure('weather-unavailable');
    if (sheetResult.status === 'rejected') return failure('sheet-unavailable');

    const { value, receivedAt } = weatherResult.value;
    const { weather, message, tags } = evaluateWeather(value);
    const regional = sheetResult.value.value.byRegion.get(region) ?? new Set();
    const pick = picks.choose(region, weather, regional);
    const categories = pick?.categories ?? [...regional]
      .filter((category) => Object.hasOwn(tagsAtRequest, category)
        && tagsAtRequest[category].some((tag) => tags.has(tag)));
    return {
      ok: true, region, basis: ['weather'], source: pick ? 'ai' : 'rule', weather,
      message: pick?.message ?? message, categories: categories.sort((a, b) => a.localeCompare(b, 'ko')),
      updatedAt: new Date(receivedAt).toISOString(),
    };
  }

  function warmUp() {
    if (recommender === 'claude') {
      for (const region of Object.keys(regions)) void recommend(region).catch(() => {});
    }
  }

  async function handler(request, response) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return send(response, 204);
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      return send(response, 405, failure('method-not-allowed'));
    }

    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/health') {
        const untagged = findUntagged(knownCategories, await tagStore.read()).length;
        return send(response, 200, {
          ok: true, untagged, lastClassifyError, classifier, tagsFileError: tagStore.fileError ?? null,
          ...picks.health(),
        });
      }
      if (url.pathname !== '/recommend') return send(response, 404, failure('not-found'));
      const region = url.searchParams.get('region');
      if (!region) return send(response, 400, failure('bad-request'));
      if (!Object.hasOwn(regions, region)) {
        warnUnknownRegion(region);
        return send(response, 404, failure('unknown-region'));
      }

      const result = await recommend(region);
      return send(response, result.ok ? 200 : 503, result);
    } catch (error) {
      logger.error(error);
      return send(response, 500, failure('internal-error'));
    }
  }

  return { handler, warmUp };
}
