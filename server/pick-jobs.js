import { applyGuard, buildPickPrompt, pickCandidates, validatePick, weatherKey } from './recommender.js';

const PICK_RETRY_DELAY = 30 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function createPickJobs({ recommender, now, enqueue, classify, tagStore }) {
  const byRegion = new Map();
  const latest = new Map();
  const errors = new Map();
  let day;

  function prune(date) {
    const today = weatherKey(date, []);
    if (day === today) return;
    day = today;
    byRegion.clear();
    latest.clear();
    errors.clear();
  }

  function choose(region, weather, regional) {
    const date = now();
    prune(date);
    const key = weatherKey(date, weather.conditions);
    latest.set(region, { key, regional });
    if (recommender !== 'claude') return null;

    if (!byRegion.has(region)) byRegion.set(region, new Map());
    const jobs = byRegion.get(region);
    if (!jobs.has(key)) jobs.set(key, { attempts: 0, failedAt: -Infinity, running: false, result: null });
    const job = jobs.get(key);
    if (job.result) {
      const categories = job.result.categories.filter((category) => regional.has(category));
      if (categories.length) return { ...job.result, categories };
      job.result = null;
    }

    if (job.running || job.attempts >= MAX_ATTEMPTS || date - job.failedAt < PICK_RETRY_DELAY) return null;
    const categories = pickCandidates(regional);
    if (!categories.length) return null;

    job.running = true;
    void enqueue(async () => {
      try {
        prune(now());
        if (latest.get(region)?.key !== key || byRegion.get(region) !== jobs) return;
        job.attempts += 1;
        const output = await classify(buildPickPrompt({ region, date, weather, categories }));
        const picked = validatePick(output, categories);
        const result = applyGuard(picked, weather.conditions, await tagStore.read());
        prune(now());
        if (byRegion.get(region) !== jobs) return;
        job.result = result;
        errors.delete(region);
      } catch (error) {
        prune(now());
        if (byRegion.get(region) !== jobs) return;
        job.failedAt = now();
        errors.delete(region);
        errors.set(region, String(error?.message ?? error).slice(0, 120));
      } finally {
        job.running = false;
      }
    });
    return null;
  }

  function health() {
    prune(now());
    const recommendations = Object.fromEntries([...latest].map(([region, { key, regional }]) => {
      const job = byRegion.get(region)?.get(key);
      const source = job?.result?.categories.some((category) => regional.has(category)) ? 'ai' : 'rule';
      return [region, { key, source, attempts: job?.attempts ?? 0, error: errors.get(region) ?? null }];
    }));
    return { lastRecommendError: [...errors.values()].at(-1) ?? null, recommendations };
  }

  return { choose, health };
}
