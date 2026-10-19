// 시트 행(string[][])을 가게 목록으로 정규화한다.

/** @typedef {{ name: string, categories: string[], groups: string[], closedDays: number[], enabled: boolean, memo: string }} Store */

const DAY_CHARS = '일월화수목금토'; // Date#getDay() 순서
const DISABLED_VALUES = ['false', 'n', '아니오', '0'];

const HEADERS = {
  name: '가게명',
  categories: '업종',
  groups: '그룹',
  closedDays: '정기휴무',
  enabled: '사용여부',
  memo: '메모',
};

/**
 * 쉼표(반각·전각)로 나누고 공백·빈 값·중복을 제거한다.
 * @param {string} value
 * @returns {string[]}
 */
export function splitMulti(value) {
  const parts = (value ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return [...new Set(parts)];
}

/**
 * '토,일' → [0, 6]. '월요일'처럼 써도 첫 글자로 인식한다.
 * @param {string} value
 * @returns {number[]}
 */
export function parseDays(value) {
  const days = new Set();
  for (const token of splitMulti(value)) {
    const day = DAY_CHARS.indexOf(token[0]);
    if (day === -1) {
      console.warn(`알 수 없는 정기휴무 값을 무시합니다: "${token}"`);
      continue;
    }
    days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isEnabled(value) {
  return !DISABLED_VALUES.includes((value ?? '').trim().toLowerCase());
}

/**
 * 첫 행을 헤더로 보고 헤더 이름으로 열을 찾는다.
 * @param {string[][]} rows
 * @returns {Store[]}
 */
export function rowsToStores(rows) {
  const header = (rows[0] ?? []).map((h) => h.replace(/^﻿/, '').trim());
  const col = Object.fromEntries(
    Object.entries(HEADERS).map(([key, label]) => [key, header.indexOf(label)]),
  );
  if (col.name === -1) throw new Error('가게명 열이 없습니다');

  const cell = (row, key) => (col[key] === -1 ? '' : (row[col[key]] ?? ''));

  const stores = rows
    .slice(1)
    .filter((row) => cell(row, 'name').trim() !== '')
    .map((row) => ({
      name: cell(row, 'name').trim(),
      categories: splitMulti(cell(row, 'categories')),
      groups: splitMulti(cell(row, 'groups')),
      closedDays: parseDays(cell(row, 'closedDays')),
      enabled: isEnabled(cell(row, 'enabled')),
      memo: cell(row, 'memo').trim(),
    }));

  for (const store of stores) {
    if (store.groups.length === 0) {
      console.warn(`그룹이 비어 있어 어떤 그룹에도 나오지 않습니다: "${store.name}"`);
    }
  }
  return stores;
}
