const STALE_LIMIT = 6 * 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;

export function createCache(load, { ttl, now, onRefresh, isCurrent = () => true }) {
  const entries = new Map();
  const pending = new Map();
  const failures = new Map();

  async function refresh(key) {
    try {
      const value = await load(key);
      const fresh = { value, receivedAt: now() };
      entries.set(key, fresh);
      failures.delete(key);
      onRefresh?.(value);
      return fresh;
    } catch (error) {
      failures.set(key, { error, retryAt: now() + RETRY_DELAY });
      throw error;
    } finally {
      pending.delete(key);
    }
  }

  return async (key) => {
    const time = now();
    const entry = entries.get(key);
    const age = entry ? time - entry.receivedAt : Infinity;
    const usable = age <= STALE_LIMIT && isCurrent(entry.receivedAt, time);
    if (usable && age < ttl) return entry;

    const failure = failures.get(key);
    if (failure && time < failure.retryAt) {
      if (usable) return entry;
      throw failure.error;
    }

    if (!pending.has(key)) {
      const request = Promise.resolve().then(() => refresh(key));
      pending.set(key, request);
      // A stale response can return before the refresh fails.
      void request.catch(() => {});
    }
    return usable ? entry : pending.get(key);
  };
}
