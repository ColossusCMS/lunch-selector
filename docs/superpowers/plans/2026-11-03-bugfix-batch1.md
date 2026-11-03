# 버그 수정 1차 Implementation Plan

> **For agentic workers:** 이 프로젝트는 협업 규약(`private-projects/shared/docs/agent-workflow.md`)을 따른다. 코덱스가 Task 순서대로 구현하고 인계 파일의 "구현 보고"를 채운다. **커밋하지 않는다**(사용자가 직접). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진단에서 확인된 버그 B1~B4와 B6′(주석)를 고친다.

**Architecture:** 판정 로직은 기존 모듈의 순수 함수로 추가해 Node로 테스트하고, `js/app.js`는 그 함수를 호출하도록 연결만 바꾼다.

**Tech Stack:** 순수 JS(ES Modules), Node 내장 test runner, 의존성 0

**Spec:** `docs/superpowers/specs/2026-11-03-bugfix-batch1-design.md`

## Global Constraints

- 새 의존성 추가 금지. `package.json` 수정 금지.
- 기존 테스트 59개 모두 계속 통과.
- 화면 문구는 설계에 적힌 그대로: "가게 목록을 불러오지 못했어요"(기존), "설정된 메뉴가 없어요"(신규).
- 설계 범위 밖(B5·B6 동작·B7·문구 개선 등)은 건드리지 않는다. 필요해 보이면 보고에 질문으로 남긴다.

## Review Focus

1. 제한 시간 타이머가 성공·실패 뒤에도 남아 있으면 Node 테스트 프로세스가 끝나지 않거나 늦게 끝난다 → 성공 경로에서 타이머가 정리되는지 (Task 2 테스트가 `npm test` 종료 시간으로 드러냄).
2. `fetchFn`이 `signal`을 무시해도(가짜 fetch, 일부 환경) 제한 시간이 동작해야 한다 → Task 2의 "signal 무시 fetch" 테스트.
3. 본문(`res.text()`)만 멈추는 경우도 제한 시간 안에 들어가야 한다 → Task 2의 "본문 지연" 테스트.
4. 다시 시도 버튼(`retry` 클릭 → `load`)도 번호를 새로 받아 이전 요청을 무효화해야 한다 → Task 3 연결 확인.
5. 저장된 모드 id가 목록에 없을 때 첫 모드로, 목록이 비면 `null` → Task 4 테스트.

---

### Task 1: B1 미사용 값 확장

**Files:**
- Modify: `js/stores.js:6` (`DISABLED_VALUES`)
- Test: `tests/stores.test.js` (`isEnabled` 테스트)

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 `test('isEnabled', ...)`의 false 목록에 값을 더한다.

```js
for (const v of ['FALSE', 'false', ' n ', 'N', '아니오', '0',
  '아니요', 'no', 'NO', 'x', 'X', '미사용', 'off', ' Off ']) assert.equal(isEnabled(v), false, v);
```
true 목록(`'TRUE', 'true', '', 'Y', '아무거나'`)은 그대로 둔다.

- [ ] **Step 2:** `npm test` → `isEnabled` FAIL (`아니요`에서) 확인
- [ ] **Step 3:** `DISABLED_VALUES`에 `'아니요', 'no', 'x', '미사용', 'off'` 추가 (소문자로; 비교는 기존대로 `trim().toLowerCase()`)
- [ ] **Step 4:** `npm test` → 전부 PASS

### Task 2: B2 시트 요청 제한 시간

**Files:**
- Modify: `js/data.js` (`loadStores`)
- Test: `tests/data.test.js`

**Interfaces:**
- Produces: `loadStores(url: string, fetchFn = fetch, { timeout = 10000 } = {}): Promise<Store[]>` — 기존 2인자 호출(`app.js`)은 그대로 동작.

- [ ] **Step 1: 실패하는 테스트 추가**

```js
test('응답이 오지 않으면 제한 시간 뒤 throw', async () =>
  assert.rejects(loadStores('x', () => new Promise(() => {}), { timeout: 20 })));

test('본문이 오지 않아도 제한 시간 뒤 throw', async () =>
  assert.rejects(loadStores('x', async () => ({ ok: true, text: () => new Promise(() => {}) }), { timeout: 20 })));

test('fetch에 signal과 no-store를 넘긴다', async () => {
  let opts;
  await loadStores('x', async (_url, o) => { opts = o; return { ok: true, text: async () => '가게명,그룹\nA,G' }; });
  assert.equal(opts.cache, 'no-store');
  assert.ok(opts.signal instanceof AbortSignal);
});
```

- [ ] **Step 2:** `npm test` → 위 테스트 FAIL 또는 멈춤 확인(멈추면 Ctrl+C 후 진행)
- [ ] **Step 3: 구현** — `AbortController`를 만들어 `signal`을 `fetchFn`에 넘기고, 같은 타이머로 **`Promise.race`의 거절도 함께** 건다(`fetchFn`이 signal을 무시해도 끝나도록). 거절 메시지에 `시간 초과`를 포함. 요청~`res.text()`~파싱 전체를 제한 시간 안에 둔다. 성공·실패 모두 `finally`에서 `clearTimeout`.
- [ ] **Step 4:** `npm test` → 전부 PASS, 테스트 실행이 기존과 비슷한 시간(1초 미만)에 끝나는지 확인 (타이머 누수 없음)

`app.js`는 수정하지 않는다. 시간 초과도 기존 `catch` 경로(실패 문구 + 다시 시도)를 탄다.

### Task 3: B3 마지막 요청만 반영

**Files:**
- Modify: `js/data.js` (함수 추가), `js/app.js` `load()` (`:281-312`)
- Test: `tests/data.test.js`

**Interfaces:**
- Produces: `createRequestCounter(): { next(): number, isLatest(id: number): boolean }` (`js/data.js`에서 export)

- [ ] **Step 1: 실패하는 테스트 추가**

```js
test('createRequestCounter: 마지막 번호만 최신', () => {
  const c = createRequestCounter();
  const a = c.next();
  assert.equal(c.isLatest(a), true);
  const b = c.next();
  assert.equal(c.isLatest(a), false);
  assert.equal(c.isLatest(b), true);
});
```

- [ ] **Step 2:** `npm test` → FAIL (export 없음)
- [ ] **Step 3: 구현** — 카운터 함수 작성. `app.js`에 모듈 수준 `const loads = createRequestCounter();`를 두고, `load()` 시작에서 `const id = loads.next();`, 기존 두 곳의 `if (mode !== state.mode) return;`을 `if (!loads.isLatest(id)) return;`으로 바꾼다. 주석 `// 그사이 다른 모드로 바뀜`은 `// 그사이 새 불러오기가 시작됨`으로.
- [ ] **Step 4:** `npm test` → 전부 PASS

### Task 4: B4 모드 0개 방어 + B6′ 주석

**Files:**
- Modify: `js/config.js` (함수 추가), `js/app.js` 마지막 줄(`:351`), `js/map.js:21` (주석만)
- Test: `tests/data.test.js` (이미 `config.js`를 import함)

**Interfaces:**
- Produces: `initialMode(list: Mode[], savedId: string | null): Mode | null` (`js/config.js`에서 export) — `savedId`와 같은 id → 그 모드, 없으면 `list[0]`, 목록이 비면 `null`.

- [ ] **Step 1: 실패하는 테스트 추가**

```js
test('initialMode: 저장값 > 첫 모드 > null', () => {
  const list = [{ id: 'lunch' }, { id: 'cafe' }];
  assert.equal(initialMode(list, 'cafe'), list[1]);
  assert.equal(initialMode(list, 'gone'), list[0]);
  assert.equal(initialMode(list, null), list[0]);
  assert.equal(initialMode([], 'cafe'), null);
});
```

- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3: 구현** — `initialMode` 작성. `app.js` 마지막 줄을 `const first = initialMode(modes(), savedMode);`로 받고, `null`이면 `setMessage('설정된 메뉴가 없어요')` + `els.spin.disabled = true`로 끝내고, 아니면 `selectMode(first)`.
- [ ] **Step 4:** `js/map.js:21` 주석을 다음으로 교체(코드 변경 없음): `주소 → 좌표 조회를 감싸 같은 주소는 다시 묻지 않는다. 예외는 캐시하지 않고 다시 묻는다. 못 찾은 결과(null)는 캐시한다.`
- [ ] **Step 5:** `npm test` → 전부 PASS

---

## DoD (완료 기준)

코덱스 자체 검증과 PM 검증이 같은 목록을 쓴다.

| ID | 기준 | 확인 방법 |
|---|---|---|
| D-1 | B1: `아니요`·`no`·`x`·`미사용`·`off`(대소문자·공백 무관)가 미사용, 기존 true 값은 그대로 | `tests/stores.test.js` `isEnabled` PASS |
| D-2 | B2: 응답·본문이 멈추면 제한 시간 뒤 reject, fetch에 `signal`·`cache: 'no-store'` 전달, 기본값 10000ms | `tests/data.test.js` 신규 3개 PASS + `js/data.js` 코드에서 기본값 확인 |
| D-3 | B2: 타이머 누수 없음 | `npm test`가 1초 안팎에 정상 종료 |
| D-4 | B3: `createRequestCounter` 동작, `load()`의 두 검사가 `isLatest`로 교체 | 테스트 PASS + `git diff js/app.js` 확인 |
| D-5 | B4: `initialMode` 동작, 모드 0개면 안내 문구·돌리기 비활성 | 테스트 PASS + `git diff js/app.js` 확인 |
| D-6 | B6′: `map.js` 주석만 변경, 코드 변화 없음 | `git diff js/map.js`가 주석 한 줄 |
| D-7 | 전체 회귀 없음 | `npm test` 실패 0, 총 개수 = 59 + 신규(5) = **64** |
| D-8 | 범위 준수 | `git diff --stat`가 `js/stores.js`, `js/data.js`, `js/app.js`, `js/config.js`, `js/map.js`, `tests/stores.test.js`, `tests/data.test.js`만 |
| D-9 | 실제 화면 정상 | PM이 로컬 서버로 열어 점심·카페 전환, 돌리기, 지도 표시 확인 |
