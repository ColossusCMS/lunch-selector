// CSV 주소에서 가게 목록을 읽어온다.

import { parseCsv } from './csv.js?v=202611041113';
import { rowsToStores } from './stores.js?v=202611041113';

/** @typedef {import('./stores.js?v=202611041113').Store} Store */

/** 불러오기마다 번호를 붙여 가장 최근 요청인지 확인한다. */
export function createRequestCounter() {
  let latest = 0;
  return {
    next: () => ++latest,
    isLatest: (id) => id === latest,
  };
}

/**
 * 응답이 '가게명' 헤더를 가진 CSV가 아니면(로그인 HTML 등) 실패로 처리한다.
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<Store[]>}
 */
export async function loadStores(url, fetchFn = fetch, options = {}) {
  return rowsToStores(await fetchCsvRows(url, fetchFn, options));
}

/**
 * CSV 요청과 본문 읽기에 같은 제한 시간을 적용한다.
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<string[][]>}
 */
export async function fetchCsvRows(url, fetchFn = fetch, { timeout = 10000 } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('가게 목록 요청 시간 초과'));
      controller.abort();
    }, timeout);
  });
  try {
    const request = (async () => {
      const res = await fetchFn(url, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`가게 목록 요청 실패: HTTP ${res.status}`);
      return parseCsv(await res.text());
    })();
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
