// CSV 주소에서 가게 목록을 읽어온다.

import { parseCsv } from './csv.js';
import { rowsToStores } from './stores.js';

/** @typedef {import('./stores.js').Store} Store */

/**
 * 응답이 '가게명' 헤더를 가진 CSV가 아니면(로그인 HTML 등) 실패로 처리한다.
 * @param {string} url
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<Store[]>}
 */
export async function loadStores(url, fetchFn = fetch) {
  const res = await fetchFn(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`가게 목록 요청 실패: HTTP ${res.status}`);
  return rowsToStores(parseCsv(await res.text()));
}
