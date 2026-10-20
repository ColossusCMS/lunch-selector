// 시트 연결 설정. 처음 한 번만 고치면 된다.

/** 시트 주소의 /d/ 와 /edit 사이 값 */
export const SHEET_ID = '1tJtC2QynaFjZUGeonxpqhsQaZse2lrBYwQC8x85Yub4';

/** 가게 목록이 있는 탭 이름 */
export const SHEET_TAB = '가게목록';

/**
 * 비워두면 SHEET_ID로 gviz 주소를 만든다.
 * "웹에 게시" CSV 주소나 'data/sample-stores.csv'를 넣으면 그 주소를 쓴다.
 */
export const CSV_URL_OVERRIDE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWy__V0_6ECJT2UuhK7vNYLbu0R5bF5tsjLofOgSu0uWXXLya3qnUOexOowE7Cksc-IXcMpg7hhkU0/pub?gid=0&single=true&output=csv';

/**
 * 카카오 JavaScript 키. 비워두면 지도 기능이 꺼진다.
 * 카카오디벨로퍼스 [앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]에
 * 사이트 주소를 등록한 키만 동작하므로 공개돼도 괜찮다.
 */
export const KAKAO_MAP_KEY = 'c509755e4abe6ed93589ebd11fc0dcb7';

const SAMPLE_URL = 'data/sample-stores.csv';

/**
 * @param {{ sheetId: string, tab: string, override: string }} opts
 * @returns {string}
 */
export function buildDataUrl({ sheetId, tab, override }) {
  if (override) return override;
  if (!sheetId) return SAMPLE_URL;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;
}

/**
 * @param {string} sheetId
 * @returns {string | null}
 */
export function buildEditUrl(sheetId) {
  return sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null;
}

export const dataUrl = () => buildDataUrl({ sheetId: SHEET_ID, tab: SHEET_TAB, override: CSV_URL_OVERRIDE });
export const editUrl = () => buildEditUrl(SHEET_ID);
