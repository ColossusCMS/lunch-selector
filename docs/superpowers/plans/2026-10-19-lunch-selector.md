# 점심 메뉴 추천 사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Sheets에 적힌 가게 목록에서, 선택 그룹·업종 필터·오늘 정기휴무를 반영해 1·2·3순위를 룰렛 연출로 뽑아주는 정적 사이트.

**Architecture:** 빌드 없는 순수 ES 모듈. 로직(CSV 파싱 → 가게 정규화 → 후보 필터·추첨)은 DOM을 모르는 순수 함수 모듈로 두고 `node --test`로 검증한다. `app.js`가 데이터 로드·UI 상태·애니메이션 호출을 묶는다. 데이터 출처는 `config.js`의 CSV URL 하나로 추상화(시트 ID 미설정 시 로컬 예시 CSV).

**Tech Stack:** HTML/CSS/JavaScript(ES modules), Node 24 내장 test runner(`node --test`), 외부 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-19-lunch-selector-design.md`

## Global Constraints

- 프론트엔드 정적 파일만. 서버·빌드 도구·프레임워크·npm 런타임 의존성 없음 (`package.json`은 테스트 스크립트 용도만).
- GitHub Pages 루트에 그대로 배포 가능해야 함 → 모든 경로는 상대 경로.
- 데이터 URL: `https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&headers=1&sheet={탭이름}` (탭이름은 `encodeURIComponent`). 기본 탭이름 `가게목록`.
- 편집 링크: `https://docs.google.com/spreadsheets/d/{ID}/edit`.
- 시트 헤더 이름(정확히): `가게명`, `업종`, `그룹`, `정기휴무`, `사용여부`, `메모`. 헤더는 1행, 열 순서 자유, 모르는 열 무시.
- 여러 값 구분자: `,` 와 `，`. 앞뒤 공백 제거, 빈 값 제거, 중복 제거.
- 요일 문자: `일월화수목금토` ↔ `Date#getDay()` 0..6. `월요일`처럼 써도 첫 글자로 인식. 모르는 값은 무시 + `console.warn`.
- `사용여부` 제외 값(대소문자·공백 무시): `false`, `n`, `아니오`, `0`. 그 외/빈칸 = 사용.
- 1·2·3순위는 서로 다른 가게. 후보 < 3이면 있는 만큼, 0이면 `조건에 맞는 가게가 없어요`.
- 로드 실패 문구: `가게 목록을 불러오지 못했어요` + `다시 시도` 버튼.
- 업종 필터: 다중 선택 OR, 미선택 = 전체, 필터가 하나라도 켜지면 업종 빈 가게 제외.
- 연출: 감속 릴 약 2초 → 1순위 강조 + 폭죽 → 2순위·3순위 약 0.35초 간격 아래에서 페이드 인. 연출 중 조작 비활성화.
- `localStorage` 키 `lunch-selector:group`. 접근 실패해도 동작.

## Review Focus

1. **따옴표·쉼표·줄바꿈이 든 셀** (`"분식,한식"`, 메모 속 줄바꿈, `""` 이스케이프) — 열이 밀리지 않아야 함. → Task 1 테스트.
2. **헤더 이름 앞뒤 공백·BOM** (`﻿가게명`, ` 그룹 `) — 열을 정상 인식해야 함. → Task 2 테스트.
3. **gviz가 체크박스를 `TRUE`/`FALSE` 대문자로, 빈 행을 빈 문자열 행으로 보냄** — 각각 사용/건너뜀. → Task 2 테스트.
4. **연출 도중 그룹·필터 변경·돌리기 연타** — 무시되어야 하고 결과가 꼬이지 않아야 함. → Task 6 수동 검증 항목.
5. **로드 실패(오프라인, 잘못된 시트 ID, CORS 대신 로그인 HTML이 옴)** — 응답이 `가게명` 헤더를 가진 CSV가 아니면 실패로 처리. → Task 4 테스트.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `package.json` | `"type": "module"`, `"test": "node --test tests/"` |
| `js/csv.js` | RFC4180 CSV 문자열 → `string[][]` |
| `js/stores.js` | 행 배열 → `Store[]` 정규화 (여러 값·요일·사용여부) |
| `js/select.js` | 그룹/업종 목록, 후보 필터, 오늘 휴무 목록, 3곳 추첨 |
| `js/config.js` | 시트 ID·탭 → 데이터 URL, 편집 URL |
| `js/data.js` | URL fetch → 검증 → `Store[]` |
| `js/animation.js` | 릴 감속 회전, 폭죽, 순차 페이드 인 (DOM) |
| `js/app.js` | 초기화, UI 상태, 이벤트, localStorage |
| `index.html`, `css/style.css` | 화면 |
| `data/sample-stores.csv` | 개발용 예시 데이터 (스펙 4.1 표와 동일) |
| `tests/*.test.js` | 순수 모듈 테스트 |
| `README.md` | 시트 만들기·연결·로컬 실행·배포 안내 |

공통 타입 (JSDoc로 `js/stores.js`에 정의):

```js
/** @typedef {{ name: string, categories: string[], groups: string[], closedDays: number[], enabled: boolean, memo: string }} Store */
```

---

### Task 1: 프로젝트 골격 + CSV 파서

**Files:**
- Create: `package.json`, `js/csv.js`, `tests/csv.test.js`

**Interfaces:**
- Produces: `export function parseCsv(text: string): string[][]`

- [ ] **Step 1: `package.json` 작성** — `{ "name": "lunch-selector", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`

- [ ] **Step 2: 실패하는 테스트 작성** (`tests/csv.test.js`, `node:test` + `node:assert/strict`)

```js
test('기본 행과 열', () => assert.deepEqual(parseCsv('a,b\n1,2'), [['a','b'],['1','2']]));
test('따옴표 안 쉼표', () => assert.deepEqual(parseCsv('"분식,한식",x'), [['분식,한식','x']]));
test('이스케이프된 따옴표', () => assert.deepEqual(parseCsv('"짬뽕 ""맛집"""'), [['짬뽕 "맛집"']]));
test('따옴표 안 줄바꿈', () => assert.deepEqual(parseCsv('"a\nb",c'), [['a\nb','c']]));
test('CRLF와 마지막 줄바꿈', () => assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a','b'],['1','2']]));
test('빈 칸 유지', () => assert.deepEqual(parseCsv('a,,c'), [['a','','c']]));
test('빈 문자열', () => assert.deepEqual(parseCsv(''), []));
```

- [ ] **Step 3: 실패 확인** — Run: `npm test` / Expected: FAIL (`parseCsv` 없음)

- [ ] **Step 4: `parseCsv` 구현** — 문자 단위 상태 기계(따옴표 안/밖). 마지막 빈 줄은 행으로 만들지 않음.

- [ ] **Step 5: 통과 확인** — Run: `npm test` / Expected: 7 pass

- [ ] **Step 6: Commit** — `git add package.json js/csv.js tests/csv.test.js && git commit -m "feat: CSV 파서 추가"`

---

### Task 2: 가게 정규화

**Files:**
- Create: `js/stores.js`, `tests/stores.test.js`

**Interfaces:**
- Consumes: 없음 (입력은 `string[][]`)
- Produces:
  - `export function splitMulti(value: string): string[]`
  - `export function parseDays(value: string): number[]` (정렬된 0..6)
  - `export function isEnabled(value: string): boolean`
  - `export function rowsToStores(rows: string[][]): Store[]` — 첫 행을 헤더로. `가게명` 헤더가 없으면 `Error('가게명 열이 없습니다')` throw.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('splitMulti', () => {
  assert.deepEqual(splitMulti(' 중식, 한식 ，중식,, '), ['중식','한식']);
  assert.deepEqual(splitMulti(''), []);
});
test('parseDays', () => {
  assert.deepEqual(parseDays('토,일'), [0,6]);
  assert.deepEqual(parseDays('월요일, 수'), [1,3]);
  assert.deepEqual(parseDays('매주 x'), []);   // 모르는 값 무시
});
test('isEnabled', () => {
  for (const v of ['TRUE','true','','Y','아무거나']) assert.equal(isEnabled(v), true);
  for (const v of ['FALSE','false',' n ','N','아니오','0']) assert.equal(isEnabled(v), false);
});
test('rowsToStores: 헤더 순서 무관·공백/BOM 헤더·모르는 열 무시·빈 가게명 건너뜀', () => {
  const rows = [
    ['﻿가게명', ' 그룹 ', '업종', '정기휴무', '사용여부', '메모', '전화'],
    ['김밥천국', '1팀,2팀', '분식,한식', '일', 'TRUE', '', '010'],
    ['', '', '', '', '', '', ''],
    ['국수나무', '1팀', '한식', '수', 'FALSE', '사용 안 함', ''],
  ];
  assert.deepEqual(rowsToStores(rows), [
    { name: '김밥천국', groups: ['1팀','2팀'], categories: ['분식','한식'], closedDays: [0], enabled: true, memo: '' },
    { name: '국수나무', groups: ['1팀'], categories: ['한식'], closedDays: [3], enabled: false, memo: '사용 안 함' },
  ]);
});
test('rowsToStores: 선택 열이 없어도 동작', () => {
  assert.deepEqual(rowsToStores([['가게명','그룹'],['본죽','2팀']]),
    [{ name: '본죽', groups: ['2팀'], categories: [], closedDays: [], enabled: true, memo: '' }]);
});
test('rowsToStores: 가게명 열 없으면 throw', () => {
  assert.throws(() => rowsToStores([['이름'],['x']]), /가게명/);
});
```

- [ ] **Step 2: 실패 확인** — `npm test` / FAIL

- [ ] **Step 3: 구현** — 헤더는 `replace(/^﻿/, '').trim()`으로 비교. 가게명·메모도 `trim()`. 요일은 각 토큰의 첫 글자를 `'일월화수목금토'.indexOf`로 매핑, `-1`이면 `console.warn`. 키 순서는 테스트와 무관(deepEqual은 키 순서 무시).

- [ ] **Step 4: 통과 확인** — `npm test` / all pass

- [ ] **Step 5: Commit** — `feat: 시트 행을 가게 목록으로 정규화`

---

### Task 3: 후보 선정과 추첨

**Files:**
- Create: `js/select.js`, `tests/select.test.js`

**Interfaces:**
- Consumes: `Store` (Task 2)
- Produces:
  - `export function listGroups(stores: Store[]): string[]` — 모든 그룹, `localeCompare('ko')` 정렬
  - `export function listCategories(stores: Store[], group: string): string[]` — 그 그룹 가게들의 업종, 정렬
  - `export function filterCandidates(stores: Store[], opts: { group: string, categories: string[], day: number }): Store[]`
  - `export function closedToday(stores: Store[], group: string, day: number): Store[]` — 그룹 소속·사용 중·오늘 휴무
  - `export function pickTop(candidates: Store[], count = 3, rng = Math.random): Store[]` — Fisher–Yates 후 앞 `count`개, 입력 배열 변경 금지

- [ ] **Step 1: 실패하는 테스트 작성** — 픽스처: 스펙 4.1 예시 6개 가게를 `Store` 객체로.

```js
test('listGroups', () => assert.deepEqual(listGroups(S), ['1팀','2팀']));
test('listCategories(1팀)', () => assert.deepEqual(listCategories(S,'1팀'), ['분식','중식','한식']));
// 월요일(1), 1팀, 필터 없음 → 진짜맛집(월 휴무)·국수나무(미사용) 제외
test('그룹+휴무+사용여부', () =>
  assert.deepEqual(names(filterCandidates(S,{group:'1팀',categories:[],day:1})), ['김밥천국','홍콩반점']));
test('일요일 1팀 → 진짜맛집만', () =>
  assert.deepEqual(names(filterCandidates(S,{group:'1팀',categories:[],day:0})), ['진짜맛집']));
test('업종 OR', () =>
  assert.deepEqual(names(filterCandidates(S,{group:'2팀',categories:['양식','분식'],day:2})), ['김밥천국','서브웨이']));
test('필터 켜면 업종 빈 가게 제외', () => {
  const T = [...S, { name:'무업종', groups:['2팀'], categories:[], closedDays:[], enabled:true, memo:'' }];
  assert.ok(!names(filterCandidates(T,{group:'2팀',categories:['한식'],day:2})).includes('무업종'));
  assert.ok(names(filterCandidates(T,{group:'2팀',categories:[],day:2})).includes('무업종'));
});
test('closedToday', () => assert.deepEqual(names(closedToday(S,'1팀',0)), ['김밥천국','홍콩반점']));
test('pickTop: 중복 없음·최대 3·입력 불변', () => {
  const c = filterCandidates(S,{group:'2팀',categories:[],day:2}); const copy = [...c];
  for (let i=0;i<50;i++){ const r = pickTop(c); assert.equal(r.length,3); assert.equal(new Set(r).size,3); }
  assert.deepEqual(c, copy);
});
test('pickTop: 후보 부족', () => { assert.equal(pickTop(S.slice(0,2)).length,2); assert.deepEqual(pickTop([]),[]); });
test('pickTop: rng 주입 시 결정적', () => {
  const rng = () => 0; assert.deepEqual(names(pickTop(S.slice(0,4),3,rng)), names(pickTop(S.slice(0,4),3,rng)));
});
```

(`names = arr => arr.map(s => s.name)`, 결과 순서는 입력 순서 유지 — `filter` 사용)

- [ ] **Step 2: 실패 확인** — `npm test` / FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test` / all pass
- [ ] **Step 5: Commit** — `feat: 후보 필터와 1·2·3순위 추첨`

---

### Task 4: 설정·데이터 로드·예시 CSV

**Files:**
- Create: `js/config.js`, `js/data.js`, `data/sample-stores.csv`, `tests/data.test.js`

**Interfaces:**
- Consumes: `parseCsv` (Task 1), `rowsToStores` (Task 2)
- Produces:
  - `config.js`: `export const SHEET_ID = '1tJtC2QynaFjZUGeonxpqhsQaZse2lrBYwQC8x85Yub4'` (사용자 제공 시트), `export const SHEET_TAB = '가게목록'`, 게시 방식 전환용 `export const CSV_URL_OVERRIDE = ''`.
    순수 함수 `export function buildDataUrl({ sheetId, tab, override }): string` — `override`가 있으면 그것, `sheetId`가 비면 `'data/sample-stores.csv'`, 아니면 Global Constraints의 gviz URL. `export function buildEditUrl(sheetId): string | null` (비면 `null`). 앱용 래퍼 `dataUrl()`/`editUrl()`은 위 상수로 호출. 개발 중 시트 대신 예시 CSV를 쓰려면 `CSV_URL_OVERRIDE = 'data/sample-stores.csv'`.
  - `data.js`: `export async function loadStores(url: string, fetchFn = fetch): Promise<Store[]>` — `!res.ok`이면 throw, 본문을 `parseCsv` → `rowsToStores` (가게명 헤더 없으면 throw → 로그인 HTML 응답도 실패 처리).

- [ ] **Step 1: 예시 CSV 작성** — 헤더 + 스펙 4.1 예시 6행. `업종`·`그룹`·`정기휴무`의 쉼표 값은 따옴표로 감쌈. 사용여부는 `TRUE`/`FALSE`.

- [ ] **Step 2: 실패하는 테스트 작성**

```js
const ok = body => async () => ({ ok: true, text: async () => body });
test('정상 CSV', async () => {
  const s = await loadStores('x', ok('가게명,그룹\n본죽,2팀'));
  assert.equal(s[0].name, '본죽');
});
test('HTTP 오류면 throw', async () =>
  assert.rejects(loadStores('x', async () => ({ ok: false, status: 404, text: async () => '' }))));
test('HTML 응답이면 throw', async () =>
  assert.rejects(loadStores('x', ok('<!DOCTYPE html><html>로그인</html>'))));
test('fetch 자체 실패면 throw', async () =>
  assert.rejects(loadStores('x', async () => { throw new TypeError('offline'); })));
test('예시 CSV 파일이 6개 가게로 읽힘', async () => {
  const text = await readFile(new URL('../data/sample-stores.csv', import.meta.url), 'utf8');
  assert.equal((await loadStores('x', ok(text))).length, 6);
});
test('buildDataUrl', () => {
  assert.equal(buildDataUrl({ sheetId: '', tab: '가게목록', override: '' }), 'data/sample-stores.csv');
  assert.equal(buildDataUrl({ sheetId: 'ID', tab: '가게목록', override: 'o.csv' }), 'o.csv');
  assert.equal(buildDataUrl({ sheetId: 'ID', tab: '가게목록', override: '' }),
    'https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv&headers=1&sheet=%EA%B0%80%EA%B2%8C%EB%AA%A9%EB%A1%9D');
});
test('buildEditUrl', () => {
  assert.equal(buildEditUrl(''), null);
  assert.equal(buildEditUrl('ID'), 'https://docs.google.com/spreadsheets/d/ID/edit');
});
```

- [ ] **Step 3: 실패 확인** — `npm test` / FAIL
- [ ] **Step 4: 구현**
- [ ] **Step 5: 통과 확인** — `npm test` / all pass
- [ ] **Step 6: Commit** — `feat: 시트 설정과 가게 목록 로드`

---

### Task 5: 화면과 상호작용 (애니메이션 없이)

**Files:**
- Create: `index.html`, `css/style.css`, `js/app.js`

**Interfaces:**
- Consumes: Task 3·4 전부. `app.js`는 `<script type="module" src="js/app.js">`.
- Produces: DOM id — `#group`(select), `#categories`(버튼 컨테이너, 각 버튼 `data-category`, 선택 시 `aria-pressed="true"`), `#reel`, `#spin`, `#rank2`, `#rank3`, `#message`, `#closed`, `#edit-link`, `#retry`. Task 6은 이 id를 사용.
- `app.js` 상태: `{ stores, group, categories: Set, spinning: boolean }`.

화면 순서는 스펙 4.4의 1~8번. 동작:
- 로드 중 `#message`에 `불러오는 중...`; 실패 시 `가게 목록을 불러오지 못했어요` + `#retry` 표시(클릭 시 재로드).
- 그룹 초기값: `localStorage['lunch-selector:group']`이 `listGroups`에 있으면 그것, 아니면 첫 번째. 변경 시 저장. `localStorage` 접근은 `try/catch`.
- 그룹 변경 → 업종 버튼 재생성·선택 초기화, 결과 초기화(릴 `?`, 순위 카드 비움). 업종 토글 → 결과 초기화.
- `#spin`: `filterCandidates(..., day: new Date().getDay())` → 0곳이면 `조건에 맞는 가게가 없어요`; 아니면 `pickTop` 결과를 릴(1순위)·`#rank2`·`#rank3`에 표시(없는 순위 카드는 숨김). 카드 내용: 가게명, 업종(`·`로 연결), 메모(있을 때). 버튼 문구는 결과 후 `다시 돌리기`.
- `#closed`: `closedToday`가 있으면 `오늘 휴무: A, B`, 없으면 숨김.
- `#edit-link`: `editUrl()`이 `null`이면 숨김, 아니면 `target="_blank" rel="noopener"`.
- 반응형: 최대 폭 약 480px 중앙 정렬, 좁은 화면에서 좌우 여백 16px.

- [ ] **Step 1: `index.html`·`style.css`·`app.js` 작성**
- [ ] **Step 2: 로컬 서버로 확인** — Run: `npx serve .` 후 브라우저에서 열기. (시트 공유가 아직 안 되어 있으면 `CSV_URL_OVERRIDE = 'data/sample-stores.csv'`로 임시 전환해 검증하고 커밋 전 원복.) Expected (예시 데이터 기준): 그룹 `1팀`/`2팀`, 1팀 선택 시 업종 버튼 `분식` `중식` `한식`, 돌리기 시 즉시 서로 다른 순위 표시, 오늘 휴무 목록이 오늘 요일과 일치, 편집 링크 숨김, 새로고침 후 그룹 유지.
- [ ] **Step 3: 실패 경로 확인** — `config.js`의 `CSV_URL_OVERRIDE`를 임시로 `'data/none.csv'`로 → 실패 문구와 다시 시도 버튼 확인 후 원복.
- [ ] **Step 4: `npm test`** — 기존 테스트 all pass
- [ ] **Step 5: Commit** — `feat: 추천 화면과 그룹·업종 필터`

---

### Task 6: 룰렛 연출 (감속 + 폭죽 + 페이드 인)

**Files:**
- Create: `js/animation.js`
- Modify: `js/app.js` (돌리기 처리), `css/style.css`

**Interfaces:**
- Produces:
  - `export function spinReel(el: HTMLElement, names: string[], final: string, duration = 2000): Promise<void>` — `requestAnimationFrame` 루프, 이름 교체 간격이 진행률 `p`에 따라 늘어남(예: `40 + 260 * p * p` ms), 끝나면 `final` 표시 + `el.classList.add('done')`.
  - `export function burstConfetti(container: HTMLElement, count = 30): void` — 색 조각 div를 떨어뜨리고 약 1.6초 뒤 제거.
  - `export function revealInOrder(els: HTMLElement[], gap = 350): Promise<void>` — `.show` 클래스를 `gap` 간격으로 부여(CSS: `opacity 0→1`, `translateY(10px)→0`, `transition .4s`).
- `prefers-reduced-motion: reduce`이면 `duration`을 0으로, 폭죽 생략(접근성, 내 결정).

참고 시안: `.superpowers/brainstorm/529-1792387815/content/animation.html`의 2번 (`playConf`).

- [ ] **Step 1: `animation.js` 작성 및 CSS 추가**
- [ ] **Step 2: `app.js` 돌리기 연결** — `state.spinning = true` 동안 `#spin`, `#group`, 업종 버튼 `disabled`. 순서: 순위 카드 `.show` 제거 → `spinReel(#reel, 후보 이름들, 1순위)` → 1순위 표시·`burstConfetti` → `revealInOrder([#rank2, #rank3] 중 표시할 것)` → `spinning = false`. 후보가 1곳이어도 릴은 돌림.
- [ ] **Step 3: 브라우저 수동 검증** — Expected: ① 약 2초 감속 후 멈춤 ② 멈추는 순간 폭죽·1순위 강조 ③ 2순위→3순위 순차 페이드 인 ④ 연출 중 돌리기 연타·그룹/업종 변경 불가 ⑤ 다시 돌리기 시 카드가 숨겨졌다가 다시 나타남 ⑥ 휴대폰 폭(개발자 도구 375px)에서 가로 스크롤 없음.
- [ ] **Step 4: `npm test`** — all pass
- [ ] **Step 5: Commit** — `feat: 룰렛 감속·폭죽·페이드 인 연출`

---

### Task 7: README와 마무리

**Files:**
- Create: `README.md`

- [ ] **Step 1: README 작성** — 포함 내용: 프로젝트 소개 한 줄 / 시트 만들기(탭 이름 `가게목록`, 헤더 `A1`부터, 열 표·예시, 체크박스 삽입, 공유 "링크가 있는 모든 사용자 – 편집자", 셀 병합·2줄 헤더 금지) / 연결(`js/config.js`의 `SHEET_ID`에 시트 주소의 `/d/`와 `/edit` 사이 값) / 로컬 실행(`npx serve .`, `index.html` 더블클릭은 동작 안 함) / 테스트(`npm test`) / GitHub Pages 배포(Settings → Pages → Branch `main` / root) / 대안: 웹에 게시 CSV 주소를 `CSV_URL_OVERRIDE`에 넣는 방법과 반영 지연(최대 약 5분).
- [ ] **Step 2: 최종 확인** — `npm test` all pass, `npx serve .`로 Task 5·6 검증 항목 재확인.
- [ ] **Step 3: Commit** — `docs: README 추가`

---

## 이후 (이 계획 범위 밖)

- 실제 시트 확인: 2026-10-19 기준 gviz·export 요청 모두 `401`(로그인 페이지) → 시트 공유가 "링크가 있는 모든 사용자"로 아직 안 되어 있음. 사용자가 공유 설정 후 `curl`로 gviz CSV가 오는지, Review Focus 3번(TRUE/FALSE·빈 행)을 확인.
- 웹에 게시 방식 시험 (`CSV_URL_OVERRIDE`).
