// 화면 초기화와 이벤트 처리.

import { modes, dataUrl, editUrl, KAKAO_MAP_KEY } from './config.js';
import { loadStores } from './data.js';
import { listGroups, listCategories, filterCandidates, closedToday, pickTop } from './select.js';
import { spinReel, burstConfetti, revealInOrder, reducedMotion } from './animation.js';
import { createMap, kakaoLink } from './map.js';

const GROUP_KEY = 'lunch-selector:group';
const MODE_KEY = 'lunch-selector:mode';
const ALL_SAVED = '*'; // 저장소에서 '전체'를 나타내는 값

const $ = (id) => document.getElementById(id);
const els = {
  heading: $('heading'),
  modes: $('modes'),
  groups: $('groups'),
  categories: $('categories'),
  stage: $('stage'),
  reel: $('reel'),
  reelSub: $('reel-sub'),
  reelLink: $('reel-link'),
  announce: $('announce'),
  spin: $('spin'),
  rank2: $('rank2'),
  rank3: $('rank3'),
  map: $('map'),
  message: $('message'),
  retry: $('retry'),
  closed: $('closed'),
  editLink: $('edit-link'),
};

const state = {
  /** @type {import('./config.js').Mode} */
  mode: null,
  /** @type {import('./stores.js').Store[]} */
  stores: [],
  /** @type {string | null} null이면 전체 */
  group: null,
  categories: new Set(),
  spinning: false,
  /** 결과를 지울 때마다 늘어난다. 늦게 끝난 주소 조회가 지운 화면에 지도를 띄우지 않게 한다. */
  round: 0,
};

const map = createMap(KAKAO_MAP_KEY);
/** 모드 id → 읽어온 가게 목록. 모드를 오가도 다시 받지 않는다. */
const storeCache = new Map();

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
  state.round += 1;
  els.reel.textContent = '?';
  els.reel.classList.remove('done');
  els.reelSub.textContent = '';
  els.reelLink.hidden = true;
  els.map.hidden = true;
  els.map.classList.remove('show');
  els.announce.textContent = '';
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
  const link = Object.assign(document.createElement('a'), {
    className: 'map-link',
    href: kakaoLink(store.name, null),
    target: '_blank',
    rel: 'noopener',
    textContent: '📍 카카오맵',
  });
  el.replaceChildren(make('label', label), make('name', store.name), make('meta', describe(store)), link);
  el.hidden = false;
}

/** 찾은 좌표로 링크를 고치고, 하나라도 찾았으면 지도에 핀을 찍는다. */
async function showOnMap(picks, located, round) {
  const points = await located;
  if (round !== state.round) return;
  const links = [els.reelLink, ...[els.rank2, els.rank3].map((el) => el.querySelector('.map-link'))];
  picks.forEach((store, i) => {
    if (links[i]) links[i].href = kakaoLink(store.name, points[i]);
  });
  const pins = picks
    .map((store, i) => ({ rank: i + 1, name: store.name, point: points[i] }))
    .filter((pin) => pin.point);
  if (pins.length === 0) return;
  els.map.hidden = false;
  try {
    await map.show(els.map, pins);
    if (round !== state.round) return;
    els.map.classList.add('show');
  } catch (err) {
    console.warn('지도를 그리지 못했어요', err);
    els.map.hidden = true;
  }
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
  const round = state.round;
  // 릴이 도는 동안 미리 주소를 조회해 둔다.
  const located = map.enabled ? Promise.all(picks.map((s) => map.locate(s.address))) : null;
  fillRank(els.rank2, '2순위', second);
  fillRank(els.rank3, '3순위', third);
  await spinReel(els.reel, candidates.map((s) => s.name), first.name, calm ? 0 : 2000);
  els.reelSub.textContent = describe(first);
  els.reelLink.href = kakaoLink(first.name, null);
  els.reelLink.hidden = false;
  // 화면 낭독기는 회전 중 이름이 아니라 최종 결과만 한 번 읽는다.
  els.announce.textContent = picks.map((s, i) => `${i + 1}순위 ${s.name}`).join(', ');
  if (!calm) burstConfetti();
  await revealInOrder([els.rank2, els.rank3].filter((el) => !el.hidden), calm ? 0 : 350);
  if (located) showOnMap(picks, located, round);
}

async function spin() {
  if (state.spinning) return;
  resetResult();
  renderClosed(); // 페이지를 연 채 날짜가 바뀌었을 수 있다
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

function renderModes() {
  const list = modes();
  els.modes.hidden = list.length < 2;
  els.modes.replaceChildren(...list.map((mode) => {
    const chip = makeChip(mode.label, mode.id, 'mode');
    chip.classList.add('mode');
    return chip;
  }));
}

function selectMode(mode) {
  state.mode = mode;
  storage.set(MODE_KEY, mode.id);
  for (const chip of els.modes.querySelectorAll('.chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.mode === mode.id));
  }
  els.heading.textContent = mode.heading;
  document.title = mode.heading.replace(/^\S+\s/, ''); // 앞의 이모지 제외
  const edit = editUrl(mode);
  els.editLink.hidden = !edit;
  if (edit) els.editLink.href = edit;
  resetResult();
  els.groups.replaceChildren();
  els.categories.replaceChildren();
  els.closed.hidden = true;
  load();
}

async function load() {
  const { mode } = state;
  setMessage('불러오는 중...');
  els.retry.hidden = true;
  els.spin.disabled = true;
  let stores;
  try {
    stores = storeCache.get(mode.id) ?? (await loadStores(dataUrl(mode)));
  } catch (err) {
    if (mode !== state.mode) return; // 그사이 다른 모드로 바뀜
    console.error(err);
    setMessage('가게 목록을 불러오지 못했어요');
    els.retry.hidden = false;
    return;
  }
  if (mode !== state.mode) return;
  state.stores = stores;

  const groups = listGroups(state.stores);
  if (groups.length === 0) {
    setMessage('시트에 가게가 없어요');
    els.retry.hidden = false;
    return;
  }
  storeCache.set(mode.id, stores); // 빈 시트는 다시 시도할 수 있게 기억하지 않는다
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

els.modes.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || state.spinning || chip.dataset.mode === state.mode.id) return;
  selectMode(modes().find((m) => m.id === chip.dataset.mode));
});

els.spin.addEventListener('click', spin);
els.retry.addEventListener('click', load);

const savedMode = storage.get(MODE_KEY);
renderModes();
selectMode(modes().find((m) => m.id === savedMode) ?? modes()[0]);
