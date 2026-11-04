// 화면 초기화와 이벤트 처리.

import { APP_VERSION, ABOUT_URL, modes, initialMode, dataUrl, editUrl, KAKAO_MAP_KEY, RATING, ratingEnabled } from './config.js?v=202611041325';
import { loadStores, fetchCsvRows, createRequestCounter } from './data.js?v=202611041325';
import { listRegions, listGroups, listCategories, filterCandidates, closedToday, pickTop } from './select.js?v=202611041325';
import { spinReel, burstConfetti, reducedMotion } from './animation.js?v=202611041325';
import { createMap, kakaoLink } from './map.js?v=202611041325';
import { THEME_KEY, THEMES, parseTheme, applyTheme } from './theme.js?v=202611041325';
import { PICK_KEY, ratingKey, aggregateRatings, cardTier, formatStatLine, parsePick, pickStatus,
  buildRatingBody, applySendResults, dropIfSame, starLabel, ratingModeLabel } from './rating.js?v=202611041325';

const GROUP_KEY = 'lunch-selector:groups';
const REGION_KEY = 'lunch-selector:region';
const MODE_KEY = 'lunch-selector:mode';
const ALL_SAVED = '*'; // 저장소에서 '전체'를 나타내는 값
const ratingsOn = ratingEnabled(RATING);

const $ = (id) => document.getElementById(id);
const els = {
  theme: $('theme'),
  heading: $('heading-text'),
  appVersion: $('app-version'),
  modes: $('modes'),
  regions: $('regions'),
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
  aboutLink: $('about-link'),
};

const state = {
  /** @type {import('./config.js?v=202611041325').Mode} */
  mode: null,
  /** @type {import('./stores.js?v=202611041325').Store[]} */
  stores: [],
  /** @type {string | null} null이면 지역 미선택, ''는 하위 호환 지역 */
  region: null,
  /** @type {string | null} null이면 전체 그룹 */
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
  const stat = state.ratings?.get(ratingKey(state.mode.id, store.region, store.name));
  const tier = state.ratings === null ? null : cardTier(stat);
  el.className = `gacha-card ${size} rank-${rank} tier-${tier?.id ?? 'none'} ${rank === 1 ? 'card-front' : 'rank'}`;
  el.dataset.tier = tier?.id ?? 'none';
  el.setAttribute('aria-label', `${rank}순위 ${store.name}`);
  const medal = make('card-medal', ['🥇', '🥈', '🥉'][rank - 1]);
  medal.setAttribute('aria-hidden', 'true');
  const inner = make('card-inner', '');
  const deco = make('card-deco', '');
  deco.setAttribute('aria-hidden', 'true');
  inner.append(deco);
  if (tier) inner.append(make('card-tier', tier.label));
  if (tier?.id === 'unknown') {
    const watermark = make('card-watermark', '?');
    watermark.setAttribute('aria-hidden', 'true');
    deco.append(watermark);
  }
  if (tier?.id === 'emerald') {
    const gem = make('card-crystal', '');
    gem.setAttribute('aria-hidden', 'true');
    deco.append(gem);
  }
  if (tier?.id === 'ruby' || tier?.id === 'diamond') {
    for (let i = 0; i < (tier.id === 'diamond' ? 3 : 2); i++) {
      const spark = make(`card-spark spark-${i}`, '');
      spark.setAttribute('aria-hidden', 'true');
      deco.append(spark);
    }
    if (tier.id === 'diamond') {
      const sweep = make('card-sweep', '');
      sweep.setAttribute('aria-hidden', 'true');
      deco.append(sweep);
    }
  }
  inner.append(make('card-name', store.name), make('card-meta', describe(store)));
  if (store.crowd) {
    const badge = make('card-crowd', `${{ 여유: '🟢', 보통: '🟡', 혼잡: '🔴' }[store.crowd]} ${store.crowd}`);
    badge.setAttribute('aria-label', `혼잡도 ${store.crowd}`);
    inner.append(badge);
  }
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
  if (typeof dialog.showModal !== 'function') return;
  const mode = modes().find((m) => m.id === pick.mode);
  const date = new Date(pick.at);
  const title = document.createElement('h2');
  title.id = 'rating-title';
  const modeLabel = ratingModeLabel(mode.label);
  const titleLine = document.createElement('span');
  titleLine.textContent = `${modeLabel.icon} ${date.getMonth() + 1}/${date.getDate()} ${modeLabel.name} 추천`;
  const subtitleLine = document.createElement('span');
  subtitleLine.textContent = '다녀온 곳이 있으면 평가해 주세요';
  title.append(titleLine, document.createTextNode(' '), subtitleLine);
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
  const later = button('다음에', 'rating-later');
  later.addEventListener('click', dismiss);
  const send = button('보내기', 'rating-send');
  const skip = button('안 갔어요');
  const choices = pick.names.map((name) => ({ name, stars: null }));
  const controls = [];
  let sending = false;
  const syncSend = () => { send.disabled = sending || !choices.some((c) => c.stars !== null); };
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
    const label = document.createElement('div');
    label.className = 'rating-star-label';
    label.setAttribute('aria-live', 'polite');
    const stars = Array.from({ length: 5 }, (_, i) => {
      const star = button('☆', 'rating-star');
      const glyph = document.createElement('span');
      glyph.className = 'rating-star-glyph';
      glyph.textContent = '☆';
      star.replaceChildren(glyph);
      star.setAttribute('aria-label', `별 ${i + 1}개`);
      star.setAttribute('aria-pressed', 'false');
      star.addEventListener('click', () => {
        choice.stars = choice.stars === i + 1 ? null : i + 1;
        stars.forEach((el, j) => {
          el.classList.remove('star-pop');
          el.classList.toggle('filled', j < choice.stars);
          el.firstElementChild.textContent = j < choice.stars ? '★' : '☆';
          el.setAttribute('aria-pressed', String(choice.stars === j + 1));
        });
        label.textContent = starLabel(choice.stars);
        if (choice.stars !== null) {
          // 연속 클릭도 CSS 애니메이션을 처음부터 재생한다.
          void options.offsetWidth;
          stars.slice(0, choice.stars).forEach((el) => el.classList.add('star-pop'));
        }
        syncSend();
      });
      return star;
    });
    controls.push(...stars);
    const rating = document.createElement('div');
    rating.className = 'rating-control';
    options.append(...stars);
    rating.append(options, label);
    row.append(name, rating);
    return row;
  });
  skip.addEventListener('click', () => {
    savePick(dropIfSame(parsePick(storage.get(PICK_KEY)), pick.at));
    dialog.close();
  });
  const actions = document.createElement('div');
  actions.className = 'rating-actions';
  actions.append(later, skip, send);
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
    for (const choice of choices.filter((c) => c.stars !== null)) {
      try {
        await fetch(RATING.formUrl, {
          method: 'POST', mode: 'no-cors',
          body: buildRatingBody(RATING.entries, { ...choice, mode: pick.mode, region: pick.region }),
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

function readGroups() {
  try {
    const value = JSON.parse(storage.get(GROUP_KEY));
    return value && !Array.isArray(value) && typeof value === 'object'
      && Object.values(value).every((v) => typeof v === 'string') ? value : {};
  } catch { return {}; }
}

function selectRegion(region) {
  state.region = region;
  state.categories.clear();
  resetResult();
  els.backHint.textContent = region === null ? '📍 지역을 먼저 골라 주세요' : '돌려서 오늘의 카드를 확인하세요';
  for (const chip of els.regions.querySelectorAll('.chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.region === region));
  }
  const groups = listGroups(state.stores, region);
  els.groups.parentElement.hidden = region === null || groups.length === 0;
  els.categories.parentElement.hidden = region === null;
  els.closed.hidden = true;
  if (region !== null) {
    const saved = readGroups();
    const legacy = storage.get('lunch-selector:group');
    if (legacy !== null) {
      if (groups.includes(legacy)) {
        saved[region] = legacy;
        storage.set(GROUP_KEY, JSON.stringify(saved));
      }
      storage.remove('lunch-selector:group');
    }
    state.group = groups.includes(saved[region]) ? saved[region] : null;
    renderGroups();
    renderCategories();
    renderClosed();
  }
  els.spin.disabled = region === null;
}

function renderGroups() {
  const chips = [makeChip('전체', null, 'group'), ...listGroups(state.stores, state.region).map((g) => makeChip(g, g, 'group'))];
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
    ...listCategories(state.stores, state.region, state.group).map((c) => makeChip(c, c, 'category')),
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
  const closed = closedToday(state.stores, state.region, state.group, today());
  els.closed.hidden = closed.length === 0;
  els.closed.textContent = `오늘 휴무: ${closed.map((s) => s.name).join(', ')}`;
}

function setControlsDisabled(disabled) {
  els.spin.disabled = disabled || state.region === null;
  for (const chip of document.querySelectorAll('.chip')) chip.disabled = disabled;
}

function selectGroup(group) {
  state.group = group;
  state.categories.clear();
  const saved = readGroups();
  storage.set(GROUP_KEY, JSON.stringify({ ...saved, [state.region]: group ?? ALL_SAVED }));
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
    savePick({ at: Date.now(), mode: state.mode.id, region: state.region, names: picks.map((s) => s.name) });
  }
  // 화면 낭독기는 회전 중 이름이 아니라 최종 결과만 한 번 읽는다.
  els.announce.textContent = picks.map((s, i) => {
    const id = [els.rank1, els.rank2, els.rank3][i].dataset.tier;
    const label = id === 'none' ? '' : `(${cardTier(state.ratings?.get(ratingKey(state.mode.id, s.region, s.name))).label.replace(/^\S+\s/, '')})`;
    return `${i + 1}순위 ${s.name}${label}`;
  }).join(', ');
  if (!calm) burstConfetti();
  if (!calm) await wait(320);
  if (round !== state.round) return;
  if (located) showOnMap(picks, located, round);
}

async function spin() {
  if (state.spinning || state.region === null) return;
  resetResult();
  renderClosed(); // 페이지를 연 채 날짜가 바뀌었을 수 있다
  const candidates = filterCandidates(state.stores, {
    region: state.region,
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
  state.region = null;
  resetResult();
  for (const el of [els.regions, els.groups, els.categories]) el.parentElement.hidden = true;
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

  const regions = listRegions(stores);
  if (regions.length === 0) {
    setMessage('시트에 가게가 없어요');
    els.retry.hidden = false;
    return;
  }
  storeCache.set(mode.id, stores);
  const saved = storage.get(REGION_KEY);
  state.region = regions.length === 1 ? regions[0] : regions.includes(saved) ? saved : null;
  els.regions.parentElement.hidden = regions.length < 2;
  els.regions.replaceChildren(...regions.map((r) => makeChip(r, r, 'region')));
  selectRegion(state.region);
  setControlsDisabled(false);
}

els.regions.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || state.spinning) return;
  storage.set(REGION_KEY, chip.dataset.region);
  if (chip.dataset.region !== state.region) selectRegion(chip.dataset.region);
});

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

els.appVersion.textContent = APP_VERSION;
els.appVersion.hidden = !APP_VERSION.trim();
els.aboutLink.hidden = !ABOUT_URL.trim();
if (ABOUT_URL.trim()) els.aboutLink.href = ABOUT_URL;

renderThemes();
selectTheme(parseTheme(storage.get(THEME_KEY)));

const savedMode = storage.get(MODE_KEY);
renderModes();
const first = initialMode(modes(), savedMode);
if (first === null) {
  setMessage('설정된 메뉴가 없어요');
  els.spin.disabled = true;
} else {
  selectMode(first);
}

try {
  initRatings();
} catch (err) {
  console.warn('평가 기능을 시작하지 못했어요', err);
}
window.__lunchReady = true;
