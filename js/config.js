// 시트 연결 설정. 처음 한 번만 고치면 된다.

/** 시트 주소의 /d/ 와 /edit 사이 값. 편집 링크와 gviz 방식에 쓴다. */
export const SHEET_ID = '1tJtC2QynaFjZUGeonxpqhsQaZse2lrBYwQC8x85Yub4';

/**
 * "웹에 게시"(전체 문서, CSV) 주소에서 /pub 까지. 비워두면 SHEET_ID로 gviz 주소를 만든다.
 * 둘 다 비우면 data/sample-stores.csv를 읽는다.
 */
export const PUBLISH_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWy__V0_6ECJT2UuhK7vNYLbu0R5bF5tsjLofOgSu0uWXXLya3qnUOexOowE7Cksc-IXcMpg7hhkU0/pub';

/**
 * 상단 전환 버튼 하나가 시트 탭 하나다. 열 구성은 탭마다 같다.
 * gid는 그 탭을 열었을 때 주소창의 #gid= 값(게시 방식), tab은 탭 이름(gviz 방식).
 * 쓰는 방식의 값이 비어 있는 모드는 버튼에서 빠지고, 남은 모드가 하나면 버튼을 숨긴다.
 */
export const MODES = [
  { id: 'lunch', label: '🍱 점심', heading: '🍱 오늘 점심 뭐 먹지?', tab: '점심메뉴', gid: '0' },
  { id: 'cafe', label: '☕ 카페', heading: '☕ 오늘 카페 어디 가지?', tab: '다과(커피)메뉴', gid: '611891333' },
];

/**
 * 카카오 JavaScript 키. 비워두면 지도 기능이 꺼진다.
 * 카카오디벨로퍼스 [앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]에
 * 사이트 주소를 등록한 키만 동작하므로 공개돼도 괜찮다.
 */
export const KAKAO_MAP_KEY = 'c509755e4abe6ed93589ebd11fc0dcb7';

const SAMPLE_URL = 'data/sample-stores.csv';

/** @typedef {{ id: string, label: string, heading: string, tab: string, gid: string }} Mode */

/**
 * @param {Mode[]} modes
 * @param {string} publishUrl
 * @returns {Mode[]}
 */
export function availableModes(modes, publishUrl) {
  return modes.filter((mode) => (publishUrl ? mode.gid : mode.tab));
}

/**
 * @param {{ sheetId: string, publishUrl: string, mode: Mode }} opts
 * @returns {string}
 */
export function buildDataUrl({ sheetId, publishUrl, mode }) {
  if (publishUrl) return `${publishUrl}?gid=${encodeURIComponent(mode.gid)}&single=true&output=csv`;
  if (!sheetId) return SAMPLE_URL;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(mode.tab)}`;
}

/**
 * @param {string} sheetId
 * @param {string} gid
 * @returns {string | null}
 */
export function buildEditUrl(sheetId, gid) {
  if (!sheetId) return null;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  return gid ? `${url}#gid=${gid}` : url;
}

export const modes = () => availableModes(MODES, PUBLISH_URL);
/** @param {Mode} mode */
export const dataUrl = (mode) => buildDataUrl({ sheetId: SHEET_ID, publishUrl: PUBLISH_URL, mode });
/** @param {Mode} mode */
export const editUrl = (mode) => buildEditUrl(SHEET_ID, mode.gid);
