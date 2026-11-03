# 캐시 섞임 방지·시작 안전망 Implementation Plan (설계 포함)

> **For agentic workers:** 협업 규약에 따라 코덱스가 구현하고 `docs/agents/handoffs/005-cache-safety.md`의 "구현 보고"를 채운다. **커밋하지 않는다.**

**Goal:** 배포 뒤 브라우저 캐시 때문에 새·옛 파일이 섞여 앱이 "불러오는 중..."에서 멈추는 일을 없애고, 어떤 이유로든 시작에 실패하면 사용자에게 알리고 다시 불러올 수 있게 한다. 부가 기능(평가)이 앱 시작을 막지 못하게 한다.

## 배경 (원인 확정, 2026-11-03)

- 증상: 갤럭시 Z 폴드8 + 네이버 웨일, 004 배포 뒤 일반 창에서 "불러오는 중..."에서 멈춤. 시크릿 창 정상, **캐시된 파일만 지우자 정상** → 캐시로 새·옛 파일이 섞임.
- GitHub Pages는 모든 파일을 `Cache-Control: max-age=600`으로 준다. 파일마다 따로 캐시되므로, 여러 파일이 함께 바뀌면 새 `app.js` + 옛 `rating.js`/`index.html` 같은 조합이 생긴다. 모듈 import 실패나 없는 요소 접근으로 스크립트가 시작하자마자 죽고, HTML 초기 문구만 남는다.
- 별도로 찾은 약점: 시작 순서상 `initRatings()`가 `selectMode()`보다 먼저라, 평가 창 열기에서 오류가 나면(예: `<dialog>.showModal` 미지원 브라우저 + 30분 지난 추천 기록) 목록 불러오기까지 멈춘다(headless Chrome 재현 완료).

## 결정 (사용자 승인: 1·2·3 모두 진행)

### 1. 파일 버전 표시 (근본 수정)

- 버전 문자열 하나를 모든 로컬 자원 주소에 붙인다: `?v=<버전>`.
  - `index.html`: `css/style.css?v=…`, `js/app.js?v=…`
  - `js/*.js`의 **모든 상대 import**: `from './rating.js?v=…'` 등. 하나라도 빠지면 같은 모듈이 두 번 로드되거나 섞일 수 있으니 전부.
- 버전 형식: 로컬 시각 `YYYYMMDDHHmm` (예: `202611031530`). 같은 날 여러 번 배포해도 겹치지 않는다.
- **올리는 도구**: `scripts/bump-version.mjs`(Node 내장 모듈만) + `package.json`의 `"bump": "node scripts/bump-version.mjs"`. 실행하면 `index.html`과 `js/*.js`의 `?v=…`를 모두 새 버전으로 바꾸고, 바꾼 파일 수와 새 버전을 출력한다.
- **일관성 테스트** `tests/version.test.js`: `index.html`의 로컬 `.js`/`.css` 참조와 `js/*.js`의 상대 import를 모두 찾아, (a) 전부 `?v=`가 있고 (b) 값이 모두 같은지 검사한다.
- 데이터 요청(`fetch` CSV)은 이미 `cache: 'no-store'`라 대상 아님. `data/sample-stores.csv`도 대상 아님.

### 2. 시작 안전망

- `index.html`에 **일반(classic) 인라인 스크립트**를 모듈보다 먼저 둔다(모듈 자체가 실패해도 동작해야 하므로).
  - 앱 모듈이 시작을 마치면 `window.__lunchReady = true`로 알린다(`app.js` 맨 끝, 첫 `selectMode` 호출 직후. 데이터 로딩 완료가 아니라 **스크립트 시작 완료** 기준 — 데이터는 기존 10초 제한·다시 시도 경로가 있다).
  - **8초** 안에 준비 신호가 없거나, 준비 전에 스크립트 오류(`window` `error` 이벤트, 모듈 `<script>`의 `error` 이벤트)가 나면 `#message`에 `화면을 불러오지 못했어요`를 쓰고 그 아래 **`새로 불러오기`** 버튼을 보여준다. 이미 준비됐다면 아무것도 하지 않는다.
  - `새로 불러오기`: 캐시를 피하도록 현재 주소에 `?r=<시각>`을 붙여 `location.replace`. (앱은 쿼리를 쓰지 않으므로 영향 없음)
  - 문구·버튼은 기존 톤(기존 `#retry` 버튼 스타일 재사용 가능). `textContent`만.

### 3. 평가 기능 격리

- 시작 순서: `selectMode(first)`(또는 모드 0개 안내) **뒤에** `initRatings()`를 호출하고, `try/catch`로 감싸 실패 시 `console.warn`만 남긴다.
- `showRatingCard`: `typeof dialog.showModal !== 'function'`이면 평가 창을 띄우지 않고 조용히 돌아간다(기록은 그대로 둠).
- 그 밖의 평가 로직·문구는 변경 없음.

## Global Constraints

- 의존성 추가 금지(`package.json`은 `scripts.bump` 추가만 허용). `js/config.js` 값 변경 금지(단, import 경로에 `?v=`를 붙이는 변경은 허용 — config.js는 import가 없으면 해당 없음). 실제 구글 폼 전송 금지.
- 기존 테스트 78개 유지 + 새 테스트. 테스트 파일의 import(`../js/x.js`)는 버전 없이 둬도 된다(Node는 쿼리 붙은 import도 해석). 단, 같은 모듈이 버전 유무로 두 번 로드돼 상태가 갈리는 테스트가 없는지 확인할 것.

## Tasks

- [ ] **Task 1:** `tests/version.test.js` 작성(실패 확인) → `scripts/bump-version.mjs`·`package.json` 스크립트 → `npm run bump` 실행으로 전 파일에 버전 부여 → 테스트 통과.
- [ ] **Task 2:** `index.html` 인라인 안전망 + `app.js` 준비 신호.
- [ ] **Task 3:** `app.js` 시작 순서 변경·`try/catch`, `showModal` 기능 검사.
- [ ] **Task 4:** `docs/SETUP.md` "GitHub Pages 배포" 절에 **배포 전 `npm run bump`** 안내 추가(이유 한 줄: 캐시 섞임 방지).
- [ ] **Task 5:** 확인(아래 DoD). 화면 확인은 저장소 밖 복사본.

## DoD

| ID | 기준 | 확인 방법 |
|---|---|---|
| C-1 | `index.html`·`js/*.js`의 모든 로컬 참조에 같은 `?v=` | `tests/version.test.js` PASS |
| C-2 | `npm run bump`가 모든 버전을 새 값으로 일괄 변경 | 실행 전후 `git diff`로 확인(확인 후 최종 버전 하나로 정리) |
| C-3 | 브라우저에서 모든 모듈·CSS가 `?v=` 주소로 요청되고 정상 동작 | headless Chrome 네트워크 로그 + 화면 |
| C-4 | 모듈 로드 실패(예: 존재하지 않는 import, 옛 파일 섞임 흉내) 시 8초 안에 `화면을 불러오지 못했어요` + `새로 불러오기`, 버튼이 `?r=`로 이동 | headless Chrome(복사본에서 일부 파일을 옛 버전으로 바꿔 재현) |
| C-5 | 정상 시작 시 안전망 문구가 절대 뜨지 않음(느린 데이터 로딩 중에도) | headless Chrome(CSV 응답 지연) |
| C-6 | `showModal` 없는 환경 + 30분 지난 기록 → 앱 정상 시작, 평가 창 생략, 기록 유지 | headless Chrome(`showModal` 삭제) |
| C-7 | 평가 초기화에서 예외가 나도 앱 정상 시작 | 코드 확인 + headless Chrome |
| C-8 | 회귀 없음 | `npm test` 전부 PASS, 가챠 카드·평가 모달 기존 동작 |
| C-9 | 범위 | 변경: `index.html`, `js/*.js`(버전·시작 순서·준비 신호), `tests/version.test.js`(신규), `scripts/bump-version.mjs`(신규), `package.json`, `docs/SETUP.md`. `js/config.js` 값 변경 없음 |
