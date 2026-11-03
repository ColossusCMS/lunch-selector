// 화면 초기화와 이벤트 처리.

import { modes, initialMode, dataUrl, editUrl, KAKAO_MAP_KEY, RATING, ratingEnabled } from './config.js';
import { loadStores, fetchCsvRows, createRequestCounter } from './data.js';
import { listGroups, listCategories, filterCandidates, closedToday, pickTop } from './select.js';
import { spinReel, burstConfetti, reducedMotion } from './animation.js';
import { createMap, kakaoLink } from './map.js';
import { THEME_KEY, THEMES, parseTheme, applyTheme } from './theme.js';
import { PICK_KEY, ratingKey, aggregateRatings, cardTier, formatStatLine, parsePick, pickStatus,
  buildRatingBody, applySendResults, dropIfSame } from './rating.js';

const GROUP_KEY = 'lunch-selector:group';
const MODE_KEY = 'lunch-selector:mode';
const ALL_SAVED = '*'; // 저장소에서 '전체'를 나타내는 값
const ratingsOn = ratingEnabled(RATING);

const $ = (id) => document.getElementById(id);
const els = {
  theme: $('theme'),
  heading: $('heading'),
  modes: $('modes'),
  groups: $('groups'),
  categories: $('categories'),
  stage: $('stage'),
  spinName: $('spin-name'),
  backHint: $('back-hint'),
  cardBack: $('card-back'),
  cardFlip: $('card-flip'),
  rank1: $('rank1'),
  ratingDialog: $('rating-dialog'),
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
  ratings: null,
  /** 결과를 지울 때마다 늘어난다. 늦게 끝난 주소 조회가 지운 화면에 지도를 띄우지 않게 한다. */
  round: 0,
};

const map = createMap(KAKAO_MAP_KEY);
/** 모드 id → 읽어온 가게 목록. 모드를 오가도 다시 받지 않는다. */
const storeCache = new Map();
const loads = createRequestCounter();

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 저장 불가 환경 무시 */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* 저장 불가 환경 무시 */ }
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
  els.spinName.textContent = '?';
  els.spinName.classList.remove('done');
  els.backHint.hidden = false;
  els.cardFlip.classList.remove('revealed');
  els.cardBack.removeAttribute('aria-hidden');
  els.cardBack.classList.remove('spinning');
  els.rank1.setAttribute('aria-hidden', 'true');
  els.rank1.inert = true;
  els.rank1.replaceChildren();
  els.rank1.className = 'gacha-card big rank-1 tier-none card-front';
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

function fillCard(el, rank, store) {
  if (!store) {
    el.hidden = true;
    return;
  }
  const make = (cls, text) => Object.assign(document.createElement('div'), { className: cls, textContent: text });
  const size = rank === 1 ? 'big' : 'small';
  const stat = state.ratings?.get(ratingKey(state.mode.id, store.name));
  const tier = state.ratings === null ? null : cardTier(stat);
  el.className = `gacha-card ${size} rank-${rank} tier-${tier?.id ?? 'none'} ${rank === 1 ? 'card-front' : 'rank'}`;
  el.dataset.tier = tier?.id ?? 'none';
  el.setAttribute('aria-label', `${rank}순위 ${store.name}`);
  const medal = make('card-medal', ['🥇', '🥈', '🥉'][rank - 1]);
  medal.setAttribute('aria-hidden', 'true');
  const inner = make('card-inner', '');
  if (tier) inner.append(make('card-tier', tier.label));
  if (tier?.id === 'unknown') {
    const watermark = make('card-watermark', '?');
    watermark.setAttribute('aria-hidden', 'true');
    inner.append(watermark);
  }
  if (tier?.id === 'emerald') {
    const gem = make('card-crystal', '');
    gem.setAttribute('aria-hidden', 'true');
    inner.append(gem);
  }
  if (tier?.id === 'ruby' || tier?.id === 'diamond') {
    for (let i = 0; i < (tier.id === 'diamond' ? 3 : 2); i++) {
      const spark = make(`card-spark spark-${i}`, '');
      spark.setAttribute('aria-hidden', 'true');
      inner.append(spark);
    }
    if (tier.id === 'diamond') {
      const sweep = make('card-sweep', '');
      sweep.setAttribute('aria-hidden', 'true');
      inner.append(sweep);
    }
  }
  inner.append(make('card-name', store.name), make('card-meta', describe(store)));
  if (tier) {
    const line = formatStatLine(stat, tier.id, size);
    const text = make('card-stat', line.text);
    text.setAttribute('aria-label', line.label);
    inner.append(text);
  }
  const link = Object.assign(document.createElement('a'), {
    className: 'map-link',
    href: kakaoLink(store.name, null),
    target: '_blank',
    rel: 'noopener',
    textContent: '📍 카카오맵',
  });
  inner.append(link);
  el.replaceChildren(medal, inner);
  if (rank === 1 && tier?.id === 'unknown') {
    const veil = make('card-veil', '?');
    veil.setAttribute('aria-hidden', 'true');
    el.append(veil);
  }
}

function savePick(pick) {
  if (pick) storage.set(PICK_KEY, JSON.stringify(pick));
  else storage.remove(PICK_KEY);
}

/** 모달은 열릴 때 읽은 추천을 유지하고, 저장값을 고칠 때만 현재 기록과 비교한다. */
function showRatingCard(pick) {
  const dialog = els.ratingDialog;
  const mode = modes().find((m) => m.id === pick.mode);
  const date = new Date(pick.at);
  const title = document.createElement('h2');
  title.id = 'rating-title';
  title.textContent = `🍽️ ${date.getMonth() + 1}/${date.getDate()} ${mode.label.replace(/^\S+\s*/, '')} 추천, 다녀온 곳이 있으면 평가해 주세요`;
  const button = (text, className = '') => Object.assign(document.createElement('button'), {
    type: 'button', textContent: text, className,
  });
  const close = button('✕', 'rating-close');
  close.setAttribute('aria-label', '다음에 평가하기');
  let dismissTimer;
  const dismiss = () => {
    clearTimeout(dismissTimer);
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('close', () => clearTimeout(dismissTimer), { once: true });
  close.addEventListener('click', dismiss);
  const later = button('다음에');
  later.addEventListener('click', dismiss);
  const send = button('보내기', 'rating-send');
  const skip = button('안 갔어요');
  const choices = pick.names.map((name) => ({ name, stars: null, like: false }));
  const controls = [];
  let sending = false;
  const syncSend = () => { send.disabled = sending || !choices.some((c) => c.stars !== null || c.like); };
  const rows = choices.map((choice) => {
    const row = document.createElement('div');
    row.className = 'rating-row';
    const name = document.createElement('div');
    name.className = 'rating-name';
    name.textContent = choice.name;
    const options = document.createElement('div');
    options.className = 'rating-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', `${choice.name} 평가`);
    const stars = Array.from({ length: 5 }, (_, i) => {
      const star = button('☆', 'rating-star');
      star.setAttribute('aria-label', `별 ${i + 1}개`);
      star.setAttribute('aria-pressed', 'false');
      star.addEventListener('click', () => {
        choice.stars = choice.stars === i + 1 ? null : i + 1;
        stars.forEach((el, j) => {
          el.textContent = j < choice.stars ? '★' : '☆';
          el.setAttribute('aria-pressed', String(choice.stars === j + 1));
        });
        syncSend();
      });
      return star;
    });
    const like = button('👍', 'rating-like');
    like.setAttribute('aria-label', '좋아요');
    like.setAttribute('aria-pressed', 'false');
    like.addEventListener('click', () => {
      choice.like = !choice.like;
      like.setAttribute('aria-pressed', String(choice.like));
      syncSend();
    });
    controls.push(...stars, like);
    options.append(...stars, like);
    row.append(name, options);
    return row;
  });
  skip.addEventListener('click', () => {
    savePick(dropIfSame(parsePick(storage.get(PICK_KEY)), pick.at));
    dialog.close();
  });
  const actions = document.createElement('div');
  actions.className = 'rating-actions';
  actions.append(send, skip, later);
  const status = document.createElement('p');
  status.className = 'rating-status';
  status.setAttribute('role', 'status');
  send.addEventListener('click', async () => {
    if (send.disabled || sending) return;
    sending = true;
    syncSend();
    for (const el of [...controls, skip]) el.disabled = true;
    const sent = [];
    const failed = [];
    for (const choice of choices.filter((c) => c.stars !== null || c.like)) {
      try {
        await fetch(RATING.formUrl, {
          method: 'POST', mode: 'no-cors',
          body: buildRatingBody(RATING.entries, { ...choice, mode: pick.mode }),
        });
        sent.push(choice.name);
      } catch {
        failed.push(choice.name);
      }
    }
    savePick(applySendResults(parsePick(storage.get(PICK_KEY)), pick.at, sent, failed));
    status.textContent = failed.length
      ? '보내지 못했어요. 다음에 다시 물어볼게요'
      : '고마워요! 반영까지 몇 분 걸릴 수 있어요';
    if (failed.length) {
      actions.replaceChildren(later);
      dialog.replaceChildren(title, status, actions);
    } else {
      const done = button('닫기', 'rating-send rating-done');
      done.addEventListener('click', dismiss);
      dialog.replaceChildren(close, title, status, done);
      if (dialog.open) {
        done.focus();
        dismissTimer = setTimeout(dismiss, 3000);
      }
    }
  });
  syncSend();
  dialog.replaceChildren(close, title, ...rows, actions, status);
  // Esc는 브라우저 기본 cancel 동작으로 닫고, 저장값은 유지한다.
  dialog.showModal();
}

function initRatings() {
  if (!ratingsOn) return;
  // 가게 목록과 독립적으로 읽는다. 늦게 도착한 평점은 다음 결과부터 쓴다.
  fetchCsvRows(RATING.csvUrl)
    .then((rows) => { state.ratings = aggregateRatings(rows); })
    .catch((err) => { console.warn('평점을 불러오지 못했어요', err); });
  const pick = parsePick(storage.get(PICK_KEY));
  if (!pick) return;
  const status = pickStatus(pick, Date.now(), modes().map((m) => m.id));
  if (status === 'drop') storage.remove(PICK_KEY);
  else if (status === 'ask') showRatingCard(pick);
}

/** 찾은 좌표로 링크를 고치고, 하나라도 찾았으면 지도에 핀을 찍는다. */
async function showOnMap(picks, located, round) {
  const points = await located;
  if (round !== state.round) return;
  const links = [els.rank1, els.rank2, els.rank3].map((el) => el.querySelector('.map-link'));
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

/** 이름 회전이 끝나면 ?로 멈춘 뒤 2·3순위, 마지막으로 1순위를 공개한다. */
async function present(picks, candidates) {
  const [first, second, third] = picks;
  const calm = reducedMotion();
  const round = state.round;
  // 릴이 도는 동안 미리 주소를 조회해 둔다.
  const located = map.enabled ? Promise.all(picks.map((s) => map.locate(s.address))) : null;
  fillCard(els.rank1, 1, first);
  fillCard(els.rank2, 2, second);
  fillCard(els.rank3, 3, third);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const revealRanks = async () => {
    for (const el of [els.rank2, els.rank3]) {
      if (el.childElementCount === 0) continue;
      if (!calm) await wait(240);
      if (round !== state.round) return;
      el.hidden = false;
      if (!calm) await new Promise(requestAnimationFrame);
      el.classList.add('show');
    }
  };
  els.backHint.hidden = true;
  if (calm) {
    await revealRanks();
  } else {
    els.cardBack.classList.add('spinning');
    // 최종 결과 이름 대신 ?에서 멈춰 1순위가 앞면 공개 전에 드러나지 않게 한다.
    await spinReel(els.spinName, candidates.map((s) => s.name), '?', 2000);
    if (round !== state.round) return;
    els.cardBack.classList.remove('spinning');
    await revealRanks();
    await wait(120);
  }
  if (round !== state.round) return;
  els.cardFlip.classList.add('revealed');
  if (!calm) await wait(280);
  if (round !== state.round) return;
  els.rank1.removeAttribute('aria-hidden');
  els.rank1.inert = false;
  els.cardBack.setAttribute('aria-hidden', 'true');
  els.rank1.classList.add('unveiled');
  if (ratingsOn) {
    savePick({ at: Date.now(), mode: state.mode.id, names: picks.map((s) => s.name) });
  }
  // 화면 낭독기는 회전 중 이름이 아니라 최종 결과만 한 번 읽는다.
  els.announce.textContent = picks.map((s, i) => {
    const id = [els.rank1, els.rank2, els.rank3][i].dataset.tier;
    const label = id === 'none' ? '' : `(${cardTier(state.ratings?.get(ratingKey(state.mode.id, s.name))).label.replace(/^\S+\s/, '')})`;
    return `${i + 1}순위 ${s.name}${label}`;
  }).join(', ');
  if (!calm) burstConfetti();
  if (!calm) await wait(320);
  if (round !== state.round) return;
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

function renderThemes() {
  els.theme.replaceChildren(...THEMES.map(({ id, icon, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.theme = id;
    button.textContent = icon;
    button.title = label;
    button.setAttribute('aria-label', label);
    return button;
  }));
}

function selectTheme(theme) {
  applyTheme(theme);
  storage.set(THEME_KEY, theme);
  for (const button of els.theme.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
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
  const id = loads.next();
  const { mode } = state;
  setMessage('불러오는 중...');
  els.retry.hidden = true;
  els.spin.disabled = true;
  let stores;
  try {
    stores = storeCache.get(mode.id) ?? (await loadStores(dataUrl(mode)));
  } catch (err) {
    if (!loads.isLatest(id)) return; // 그사이 새 불러오기가 시작됨
    console.error(err);
    setMessage('가게 목록을 불러오지 못했어요');
    els.retry.hidden = false;
    return;
  }
  if (!loads.isLatest(id)) return;
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

els.theme.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button) selectTheme(button.dataset.theme);
});

els.spin.addEventListener('click', spin);
els.retry.addEventListener('click', load);

renderThemes();
selectTheme(parseTheme(storage.get(THEME_KEY)));
initRatings();

const savedMode = storage.get(MODE_KEY);
renderModes();
const first = initialMode(modes(), savedMode);
if (first === null) {
  setMessage('설정된 메뉴가 없어요');
  els.spin.disabled = true;
} else {
  selectMode(first);
}
