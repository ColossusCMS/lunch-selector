// 시트 행(string[][])을 가게 목록으로 정규화한다.

/** @typedef {{ name: string, categories: string[], groups: string[], closedDays: number[], region: string, crowd: string | null, memo: string, address: string }} Store */

const DAY_CHARS = '일월화수목금토'; // Date#getDay() 순서

const HEADERS = {
  name: '가게명',
  categories: '업종',
  groups: '그룹',
  closedDays: '정기휴무',
  region: '지역',
  crowd: '혼잡도',
  memo: '메모',
  address: '주소',
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
 * '토,일' → [0, 6]. 쉼표 대신 공백·/·· 로 나누거나 '토일'처럼 붙여 써도,
 * '월요일'처럼 써도 인식한다.
 * @param {string} value
 * @returns {number[]}
 */
export function parseDays(value) {
  const days = new Set();
  const tokens = (value ?? '').split(/[,，\s/·]+/).filter(Boolean);
  for (const token of tokens) {
    const chars = [...token.replace(/요일$/, '')];
    if (chars.length === 0 || !chars.every((c) => DAY_CHARS.includes(c))) {
      console.warn(`알 수 없는 정기휴무 값을 무시합니다: "${token}"`);
      continue;
    }
    for (const c of chars) days.add(DAY_CHARS.indexOf(c));
  }
  return [...days].sort((a, b) => a - b);
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

  const hasRegions = rows.slice(1).some((row) => cell(row, 'name').trim() && cell(row, 'region').trim());
  const stores = rows
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => cell(row, 'name').trim() !== '')
    .filter(({ row }) => {
      if (hasRegions && splitMulti(cell(row, 'region')).length === 0) {
        console.warn(`지역이 비어 있어 나오지 않습니다: ${cell(row, 'name')}`);
        return false;
      }
      return true;
    })
    .map(({ row, rowNumber }) => {
      const region = cell(row, 'region').trim();
      if (/[,，]/.test(region)) console.warn(`지역은 첫 값만 사용합니다: ${region}`);
      const crowd = cell(row, 'crowd').trim();
      const validCrowd = ['여유', '보통', '혼잡'].includes(crowd);
      if (crowd && !validCrowd) console.warn(`알 수 없는 혼잡도: ${crowd}`);
      return { rowNumber, store: {
        name: cell(row, 'name').trim(),
        categories: splitMulti(cell(row, 'categories')),
        groups: splitMulti(cell(row, 'groups')),
        closedDays: parseDays(cell(row, 'closedDays')),
        region: splitMulti(region)[0] ?? '',
        crowd: validCrowd ? crowd : null,
        memo: cell(row, 'memo').trim(),
        address: cell(row, 'address').trim(),
      } };
    });

  const merged = new Map();
  for (const { store, rowNumber } of stores) {
    const key = JSON.stringify([store.region, store.name]);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { store, rows: [rowNumber] });
      continue;
    }
    previous.rows.push(rowNumber);
    previous.store.groups = [...new Set([...previous.store.groups, ...store.groups])];
    previous.store.categories = [...new Set([...previous.store.categories, ...store.categories])];
    console.warn(`중복 가게를 합칩니다: 지역 "${store.region || '(지역 없음)'}", 가게 "${store.name}" — 시트 ${previous.rows.join(', ')}행 (${previous.rows.length}개 행)`);
  }
  return [...merged.values()].map(({ store }) => store);
}
