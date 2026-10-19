// 화면 초기화와 이벤트 처리.

import { dataUrl, editUrl } from './config.js';
import { loadStores } from './data.js';
import { listGroups, listCategories, filterCandidates, closedToday, pickTop } from './select.js';
import { spinReel, burstConfetti, revealInOrder, reducedMotion } from './animation.js';

const GROUP_KEY = 'lunch-selector:group';
const ALL_SAVED = '*'; // 저장소에서 '전체'를 나타내는 값

const $ = (id) => document.getElementById(id);
const els = {
  groups: $('groups'),
  categories: $('categories'),
  stage: $('stage'),
  reel: $('reel'),
  reelSub: $('reel-sub'),
  spin: $('spin'),
  rank2: $('rank2'),
  rank3: $('rank3'),
  message: $('message'),
  retry: $('retry'),
  closed: $('closed'),
  editLink: $('edit-link'),
};

const state = {
  /** @type {import('./stores.js').Store[]} */
  stores: [],
  /** @type {string | null} null이면 전체 */
  group: null,
  categories: new Set(),
  spinning: false,
};

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 저장 불가 환경 무시 */ }
  },
};

const today = () => new Date().getDay();

const describe = (store) =>
  [store.categories.join('·'), store.memo].filter(Boolean).join(' · ');

function setMessage(text) {
  els.message.textContent = text;
}

function resetResult() {
  els.reel.textContent = '?';
  els.reel.classList.remove('done');
  els.reelSub.textContent = '';
  for (const el of [els.rank2, els.rank3]) {
    el.hidden = true;
    el.classList.remove('show');
    el.replaceChildren();
  }
  els.spin.textContent = '🎰 돌리기';
  setMessage('');
}

function fillRank(el, label, store) {
  if (!store) {
    el.hidden = true;
    return;
  }
  const make = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  el.replaceChildren(make('label', label), make('name', store.name), make('meta', describe(store)));
  el.hidden = false;
}

/** value가 null이면 [전체] 칩 */
function makeChip(label, value, key) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  if (value !== null) chip.dataset[key] = value;
  return chip;
}

function renderGroups() {
  const chips = [makeChip('전체', null, 'group'), ...listGroups(state.stores).map((g) => makeChip(g, g, 'group'))];
  els.groups.replaceChildren(...chips);
  syncGroupChips();
}

function syncGroupChips() {
  for (const chip of els.groups.querySelectorAll('.chip')) {
    chip.setAttribute('aria-pressed', String((chip.dataset.group ?? null) === state.group));
  }
}

function renderCategories() {
  const chips = [
    makeChip('전체', null, 'category'),
    ...listCategories(state.stores, state.group).map((c) => makeChip(c, c, 'category')),
  ];
  els.categories.replaceChildren(...chips);
  syncCategoryChips();
}

function syncCategoryChips() {
  for (const chip of els.categories.querySelectorAll('.chip')) {
    const { category } = chip.dataset;
    const pressed = category === undefined ? state.categories.size === 0 : state.categories.has(category);
    chip.setAttribute('aria-pressed', String(pressed));
  }
}

function renderClosed() {
  const closed = closedToday(state.stores, state.group, today());
  els.closed.hidden = closed.length === 0;
  els.closed.textContent = `오늘 휴무: ${closed.map((s) => s.name).join(', ')}`;
}

function setControlsDisabled(disabled) {
  els.spin.disabled = disabled;
  for (const chip of document.querySelectorAll('.chip')) chip.disabled = disabled;
}

function selectGroup(group) {
  state.group = group;
  state.categories.clear();
  storage.set(GROUP_KEY, group ?? ALL_SAVED);
  syncGroupChips();
  renderCategories();
  renderClosed();
  resetResult();
}

/** 감속 릴 → 1순위 강조·폭죽 → 2·3순위 순차 페이드 인 */
async function present(picks, candidates) {
  const [first, second, third] = picks;
  const calm = reducedMotion();
  fillRank(els.rank2, '2순위', second);
  fillRank(els.rank3, '3순위', third);
  await spinReel(els.reel, candidates.map((s) => s.name), first.name, calm ? 0 : 2000);
  els.reelSub.textContent = describe(first);
  if (!calm) burstConfetti();
  await revealInOrder([els.rank2, els.rank3].filter((el) => !el.hidden), calm ? 0 : 350);
}

async function spin() {
  if (state.spinning) return;
  resetResult();
  const candidates = filterCandidates(state.stores, {
    group: state.group,
    categories: [...state.categories],
    day: today(),
  });
  if (candidates.length === 0) {
    setMessage('조건에 맞는 가게가 없어요');
    return;
  }
  state.spinning = true;
  setControlsDisabled(true);
  try {
    await present(pickTop(candidates), candidates);
  } finally {
    state.spinning = false;
    setControlsDisabled(false);
    els.spin.textContent = '🎰 다시 돌리기';
  }
}

async function load() {
  setMessage('불러오는 중...');
  els.retry.hidden = true;
  try {
    state.stores = await loadStores(dataUrl());
  } catch (err) {
    console.error(err);
    setMessage('가게 목록을 불러오지 못했어요');
    els.retry.hidden = false;
    return;
  }

  const groups = listGroups(state.stores);
  if (groups.length === 0) {
    setMessage('조건에 맞는 가게가 없어요');
    return;
  }
  const saved = storage.get(GROUP_KEY);
  const initial = saved === ALL_SAVED ? null : groups.includes(saved) ? saved : groups[0];
  state.group = initial;
  renderGroups();
  selectGroup(initial);
  setControlsDisabled(false);
}

els.groups.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || state.spinning) return;
  const group = chip.dataset.group ?? null;
  if (group !== state.group) selectGroup(group);
});

els.categories.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || state.spinning) return;
  const { category } = chip.dataset;
  if (category === undefined) state.categories.clear();
  else if (state.categories.has(category)) state.categories.delete(category);
  else state.categories.add(category);
  syncCategoryChips();
  resetResult();
});

els.spin.addEventListener('click', spin);
els.retry.addEventListener('click', load);

const edit = editUrl();
if (edit) {
  els.editLink.href = edit;
  els.editLink.hidden = false;
}

load();
