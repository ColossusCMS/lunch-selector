import { loadStores } from '../js/data.js';
import { createCache } from './cache.js';

export function createSheetCache({ sheetCsvUrl, fetchFn, now, onRefresh }) {
  return createCache(async () => {
    const stores = await loadStores(sheetCsvUrl, fetchFn);
    const byRegion = new Map();
    const all = new Set();
    for (const { region, categories } of stores) {
      if (!byRegion.has(region)) byRegion.set(region, new Set());
      for (const category of categories) {
        byRegion.get(region).add(category);
        all.add(category);
      }
    }
    return { byRegion, all };
  }, { now, ttl: 10 * 60 * 1000, onRefresh });
}
