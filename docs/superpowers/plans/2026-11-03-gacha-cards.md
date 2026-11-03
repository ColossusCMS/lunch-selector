# 가챠 카드 Implementation Plan

> **For agentic workers:** 협업 규약에 따라 코덱스가 Task 순서대로 구현하고 인계 파일 `docs/agents/handoffs/004-gacha-cards.md`의 "구현 보고"를 채운다. **커밋하지 않는다.**

**Goal:** 결과를 순위(무대·메달·외곽 빛) × 평점 등급(보석) 카드로 보여주고, 1순위는 밤하늘 뒷면에서 이름이 돌다가 뒤집혀 공개되게 한다.

**Architecture:** 등급 판정·평가 줄 문구는 `js/rating.js` 순수 함수(테스트). 카드 DOM 생성·연출은 `js/app.js`(필요하면 `js/animation.js`에 연출 보조 함수 추가). 시각은 `css/style.css`에 시안을 옮겨 다듬는다.

**Tech Stack:** 순수 JS(ES Modules), CSS(그라데이션·그림자·애니메이션·`@property`), Node 내장 test runner, 의존성 0

**Spec:** `docs/superpowers/specs/2026-11-03-gacha-cards-design.md` — 시안 두 개(`specs/assets/2026-11-03-gacha-cards-mockup.html`, `…-gacha-card-back-mockup.html`의 B)를 **브라우저로 열어 보고** 시각 기준으로 삼는다.

## Global Constraints

- 의존성·이미지 파일 추가 금지. `js/config.js` 수정 금지(사용자 실제 평점 설정 있음). 실제 구글 폼 전송 금지(화면 확인은 저장소 밖 복사본·가짜 응답).
- `textContent`만. 장식 요소는 `aria-hidden="true"`.
- 등급 경계: 미확인(별점 평가 < 2건) / 원석 < 3.0 / 에메랄드 3.0~ / 루비 4.0~ / 다이아 4.5~ (반올림된 평균으로 비교).
- 이름표 문구: `❔ 미확인`, `🪨 원석`, `💚 에메랄드`, `❤️ 루비`, `💎 다이아`. 메달 🥇🥈🥉.
- 뒷면 대기 문구: `돌려서 오늘의 카드를 확인하세요`.
- 전체 연출 길이는 지금과 비슷하게(릴 약 2초 + 공개). `prefers-reduced-motion`이면 움직임 없이 즉시 결과.
- 360px 폭에서 2·3순위 두 장 나란히, 가로 넘침 없음.

## Review Focus

1. 평점 CSV가 늦게 도착하거나 실패해도 결과 카드가 깨지지 않아야 한다(등급 없는 기본 카드) → Task 3 상태(`state.ratings`가 `null`=미수신/실패, `Map`=수신) 구분 + 화면 확인.
2. 돌리는 중 그룹·모드를 바꿀 수 없지만, 결과 후 바꾸면 1순위가 **뒷면으로 되돌아가야** 한다(앞면이 남아 있으면 안 됨) → Task 3 `resetResult` + 화면 확인.
3. 후보가 1~2곳뿐이라 2·3순위가 없을 때 순서·레이아웃이 깨지지 않아야 한다 → 화면 확인.
4. 긴 가게명이 큰 카드·작은 카드·뒷면 회전 중에 넘치지 않아야 한다 → 화면 확인(360px).
5. 같은 평균이라도 반올림 경계(4.45 → 4.5 → 다이아)가 화면 표시와 일치해야 한다 → Task 1 테스트.

---

### Task 1: 등급·평가 줄 순수 함수 (`js/rating.js`)

**Files:** Modify `js/rating.js`, `tests/rating.test.js`

**Interfaces (Produces):**
```js
/** @typedef {{ likes: number, avg: number | null, count: number }} RatingStat */   // count = 유효 별점 개수 (추가)
export const TIER_MIN_COUNT = 2;
export const TIERS = [   // 높은 것부터
  { id: 'diamond', label: '💎 다이아', min: 4.5 },
  { id: 'ruby', label: '❤️ 루비', min: 4.0 },
  { id: 'emerald', label: '💚 에메랄드', min: 3.0 },
  { id: 'stone', label: '🪨 원석', min: -Infinity },
];
export const UNKNOWN_TIER = { id: 'unknown', label: '❔ 미확인' };
export function cardTier(stat: RatingStat | undefined): { id, label }        // count < 2 또는 stat 없음 → UNKNOWN_TIER
export function formatStatLine(stat: RatingStat | undefined, tierId: string, size: 'big' | 'small'): { text: string, label: string }
```
- `formatBadge`는 삭제하고 테스트도 `formatStatLine` 테스트로 교체. `aggregateRatings`는 `count`를 함께 돌려준다(기존 기대값에 `count` 추가).

- [ ] **Step 1: 테스트 작성/교체**
```js
test('cardTier: 2건 미만은 미확인, 반올림 평균으로 경계 판정', () => {
  assert.equal(cardTier(undefined).id, 'unknown');
  assert.equal(cardTier({ likes: 9, avg: 5, count: 1 }).id, 'unknown');
  assert.equal(cardTier({ likes: 0, avg: 2.9, count: 2 }).id, 'stone');
  assert.equal(cardTier({ likes: 0, avg: 3.0, count: 2 }).id, 'emerald');
  assert.equal(cardTier({ likes: 0, avg: 4.0, count: 3 }).id, 'ruby');
  assert.equal(cardTier({ likes: 0, avg: 4.5, count: 3 }).id, 'diamond');   // avg는 aggregateRatings가 이미 반올림한 값
  assert.equal(cardTier({ likes: 0, avg: 4.4, count: 3 }).id, 'ruby');
});
test('aggregateRatings: count는 유효 별점 개수', () => {
  const rows = [['모드', '가게명', '별점', '좋아요'], ['l', 'A', '4', '1'], ['l', 'A', '', '1'], ['l', 'A', '9', ''], ['l', 'A', '5', '']];
  assert.deepEqual(aggregateRatings(rows).get(ratingKey('l', 'A')), { likes: 2, avg: 4.5, count: 2 });
});
test('formatStatLine', () => {
  assert.deepEqual(formatStatLine({ likes: 12, avg: 4.2, count: 5 }, 'ruby', 'big'), { text: '★4.2 · 👍12', label: '평균 별점 4.2점, 좋아요 12개' });
  assert.deepEqual(formatStatLine({ likes: 0, avg: 3.5, count: 2 }, 'emerald', 'small'), { text: '★3.5', label: '평균 별점 3.5점' });
  assert.deepEqual(formatStatLine({ likes: 3, avg: 5, count: 1 }, 'unknown', 'big'), { text: '👍3 · 평가 부족', label: '좋아요 3개, 평가 부족' });
  assert.deepEqual(formatStatLine(undefined, 'unknown', 'big'), { text: '아직 평가가 부족해요', label: '아직 평가가 부족해요' });
  assert.deepEqual(formatStatLine(undefined, 'unknown', 'small'), { text: '평가 부족', label: '아직 평가가 부족해요' });
});
```
기존 `aggregateRatings` 테스트의 `deepEqual` 기대값에 `count`를 추가한다(예: `{ likes: 2, avg: 4.5, count: 2 }`).
- [ ] **Step 2:** `npm test` → FAIL 확인 → **Step 3:** 구현 → **Step 4:** `npm test` 전부 PASS

### Task 2: 카드 마크업·스타일

**Files:** Modify `index.html`, `css/style.css`

- [ ] `#stage`: 1순위 카드 자리 하나(앞·뒷면을 가진 뒤집기 구조). 뒷면 = 시안 B, 처음부터 보임. 앞면 = 등급 카드(큰 형태). 기존 `#reel`·`#reel-sub`·`#reel-link`·`#reel-rating`은 이 구조로 대체(지도 링크는 카드 안으로). 이름 회전은 뒷면 위에서.
- [ ] `.ranks`: 2·3순위 작은 카드 두 장(지금 위치 그대로).
- [ ] 클래스 규칙(이름은 재량, 의미는 고정): 순위(`rank-1/2/3`: 외곽 빛 금·은·동 + 메달), 등급(`tier-unknown/stone/emerald/ruby/diamond`), 등급 없는 기본 카드(`tier-none`), 크기(`big/small`).
- [ ] 시안의 등급 표현을 옮기되 실제 화면과 어울리게 다듬기. 라이트·다크. `@media (prefers-reduced-motion: reduce)`에서 회전·빛줄기·반짝임·뒤집기 애니메이션 끔.
- [ ] 기존 `.rating-badge` 스타일 제거.

### Task 3: 연출 연결 (`js/app.js`, 필요 시 `js/animation.js`)

**Interfaces (Consumes):** Task 1 `cardTier`, `formatStatLine`.

- [ ] `state.ratings`: 평점 기능 꺼짐·미수신·실패 = `null`, 수신 성공 = `Map`. `null`이면 모든 카드 `tier-none`(이름표·평가 줄 없음).
- [ ] 카드 채우기 함수 하나로 큰/작은 카드를 만든다: 이름표, 메달, 이름, `describe(store)`, 평가 줄(`textContent`=text, `aria-label`=label), `📍 카카오맵` 링크(기존 `kakaoLink`·`showOnMap`의 링크 갱신이 계속 동작해야 함).
- [ ] `present()` 순서: 뒷면에서 이름 회전 시작(기존 `spinReel` 재사용 가능) → 회전 중 2순위 → 3순위 등장 → 회전 종료 후 1순위 뒤집기. 다이아면 섬광 + `burstConfetti`, 미확인이면 `?` 실루엣이 걷히는 효과 + 폭죽, 나머지 뒤집기 + 폭죽. `calm`이면 즉시 앞면·폭죽 없음(기존과 같음).
- [ ] 공개 전 내용이 낭독되지 않게: 2·3순위는 공개 전 `hidden`, 1순위 앞면은 뒤집히기 전 `aria-hidden`/`inert`.
- [ ] `#announce`: `1순위 본죽(다이아), 2순위 …` (기본 카드면 이름만).
- [ ] `resetResult()`: 1순위를 뒷면 상태로 되돌리고, 2·3순위 숨김.
- [ ] 마지막 추천 저장(`PICK_KEY`), 지도, 회차 가드(`state.round`) 등 기존 동작 유지.

### Task 4: 확인

- [ ] `npm test` 전부 PASS, `node --check js/app.js`.
- [ ] 저장소 밖 복사본 + 가짜 평점 CSV로 5등급·기본 카드·360px·라이트/다크·동작 줄이기 스크린샷. 실제 폼 전송 금지.

---

## DoD

| ID | 기준 | 확인 방법 |
|---|---|---|
| G-1 | `count` 집계, `cardTier` 경계·미확인 판정 | `tests/rating.test.js` PASS |
| G-2 | `formatStatLine` 문구·낭독 이름, `formatBadge` 제거 | 테스트 PASS + `git diff` |
| G-3 | 첫 화면·`resetResult` 후 1순위 자리에 밤하늘 뒷면(시안 B), 높이 변화 없음 | 화면 확인 |
| G-4 | 돌리기: 뒷면 위 이름 회전 → 2순위 → 3순위 → 1순위 뒤집기, 전체 길이 지금과 비슷 | 화면 확인 |
| G-5 | 등급 5종 + 기본 카드가 시안처럼 구분됨(큰·작은 카드), 메달·외곽 빛(금·은·동) | 스크린샷 |
| G-6 | 다이아 섬광, 미확인 `?` 걷힘, 그 외 뒤집기 + 폭죽 | 화면 확인 |
| G-7 | 평점 꺼짐·실패 시 기본 카드, 수신했으나 기록 없음은 미확인 | 화면 확인 |
| G-8 | 동작 줄이기: 움직임 없이 즉시 결과, 등급 색 유지 | 화면 확인 |
| G-9 | 낭독: 공개 전 미리 읽히지 않음, `#announce`에 등급 | 코드 확인 + DOM 확인 |
| G-10 | 360px 라이트/다크, 긴 가게명, 2·3순위 없는 경우 레이아웃 정상 | 스크린샷 |
| G-11 | 회귀·범위 | `npm test` 실패 0, 변경 파일: `js/rating.js`, `tests/rating.test.js`, `js/app.js`, `index.html`, `css/style.css`(+ 필요 시 `js/animation.js`), `js/config.js` 변경 없음 |
