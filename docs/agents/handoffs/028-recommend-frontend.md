# 028 AI 메뉴 추천 프론트 (`🤖 AI 메뉴 추천` 켜기·끄기)

## 지시 (PM)
- 설계서: `docs/design/2026-11-25/ai-menu-recommend-design.md`. **5절(프론트)과 6절의 프론트 항목이 이번 범위다.** 설계서와 이 지시서가 다르면 이 지시서를 따른다.
- 화면 샘플: `docs/design/2026-11-25/weather-recommend-mockup.html`. 배치, 버튼 모양, 배지, 안내 문구, 가이드 카드를 **이 샘플대로** 만든다. 샘플의 조작판은 넣지 않는다.
- 서버: 027에서 완료(`server/`, 미커밋). 응답 계약은 설계서 4.3과 `server/app.js` 실제 구현을 따른다. `updatedAt`은 **UTC ISO**(`...Z`)다.
- 회차: 최초. 작업트리에는 027 변경이 미커밋으로 남아 있다. 그 위에 이어서 하고, 서버 코드는 아래 부가 항목 외에는 건드리지 않는다.

### 목표
점심 모드에서 사용자가 `🤖 AI 메뉴 추천`을 켜면, 서버가 준 업종 중 지금 화면에 보이는 업종 버튼을 자동으로 켠다. 꺼져 있을 때는 업종을 건드리지 않고, 비·더위·추위인 날에만 날씨 배지를 보여준다.

### 바꿀 것
- `js/config.js`
  - `export const RECOMMEND_URL = '';`(서버 주소, 끝 `/` 없음)
  - `export const RECOMMEND_MODE = 'lunch';`(추천을 쓰는 모드 id)
  - 운영 값은 **빈 문자열로 둔다.** 실제 주소는 사용자가 서버를 띄운 뒤 넣는다.
- `js/recommend.js` (신규, DOM 없음)
  - `buildRecommendUrl(base, region)`: `${base}/recommend?region=<encodeURIComponent>`
  - `parseRecommendation(json)`: `ok === true`, `region` 문자열, `categories` 문자열 배열, `weather.badge` 문자열, `message` 문자열, `updatedAt`이 파싱 가능한 날짜인지 확인한다. 하나라도 틀리면 `null`이다. 모르는 필드는 무시한다. 반환하는 객체는 필요한 필드만 골라 만든다.
  - `fetchRecommendation(url, fetchFn = fetch, { timeout = 3000 })`: `AbortController`로 제한하고, HTTP 오류·JSON 오류·시간 초과는 모두 `null`이다. 예외를 밖으로 던지지 않는다.
  - `pickVisibleCategories(recommended, visible)`: `visible` 순서를 유지한 교집합이다.
  - `formatUpdatedAt(iso)`: **`new Date(iso)`로 파싱한 뒤 `Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })`** 로 `HH:mm`을 만든다. 문자열을 잘라 쓰지 않는다(UTC라 9시간 어긋난다).
- `index.html`
  - `h1` 바로 아래, 지역 `filter-row` 위에 `추천` `filter-row`를 추가한다(샘플과 같은 구조, 처음엔 `hidden`).
  - 그 아래 안내 문구 `<p>`(처음엔 `hidden`)
  - 가이드 카드. `<aside>` 또는 `<dialog>`를 쓴다. 모달로 만들지 말고 화면을 막지 않는다.
- `css/style.css`: 샘플의 `.weather-toggle`, `.switch`, `.weather-badge`, `.weather-message`, `.guide` 스타일을 옮긴다. 클래스 이름은 `recommend-*`로 바꿔도 된다. 라이트·다크 둘 다 기존 토큰만 쓴다. 휴대폰 폭(360px)에서 줄이 넘치지 않게 한다.
- `js/app.js`: 아래 "동작"을 연결한다.
- `tests/recommend.test.js`: 아래 DoD F-1.
- `README.md`: 기능 소개에 한 줄, 테스트 수 갱신. `docs/SETUP.md` 서버 절에 `RECOMMEND_URL` 넣는 법을 한 줄 추가한다.
- 끝에 `npm run bump`.

### 동작
- **추천 줄을 보여주는 조건** (모두 참일 때)
  - `RECOMMEND_URL`이 비어 있지 않음
  - `state.mode.id === RECOMMEND_MODE`
  - 지역이 정해짐: `state.region`이 `null`도 아니고 `''`(하위 호환 지역 없음)도 아님
  - 그 지역의 추천 응답이 `parseRecommendation`을 통과함
  - 하나라도 아니면 줄, 문구, 배지를 숨긴다. 이미 켜진 설정값(on)은 저장된 그대로 둔다.
- **요청**
  - 위 조건 중 앞의 세 개가 참이 될 때(첫 로딩, 지역 변경, 점심 모드로 전환) 그 지역으로 요청한다. 켜짐·꺼짐과 상관없이 요청한다(배지에 필요).
  - 지역별 결과(실패하면 `null`)는 페이지에 있는 동안 메모리에 캐시하고 다시 요청하지 않는다.
  - 늦게 온 응답은 기존 `createRequestCounter` 패턴으로 버린다. 응답이 왔을 때 현재 지역이 그 지역이 아니면 반영하지 않는다.
  - 요청은 가게 목록 로딩, 돌리기 버튼, 평가 흐름을 **기다리게 하지 않는다**.
- **켜짐 상태**
  - 켜는 순간, 지역 변경(`selectRegion`), 그룹 변경(`selectGroup`)으로 업종이 초기화된 직후, 그리고 그 지역의 응답이 처음 도착했을 때 적용한다.
  - 적용: `state.categories`를 `pickVisibleCategories(rec.categories, listCategories(state.stores, state.region, state.group))`로 채우고 `syncCategoryChips()`를 부른다.
  - 교집합이 비면 [전체] 상태(빈 Set)로 둔다.
  - 안내 문구: `message` + 작은 줄 `🤖 AI 추천 · <지역> 점심시간 날씨 기준 · <formatUpdatedAt> 갱신`
  - 배지는 숨긴다.
  - 응답이 도착했을 때 사용자가 이미 업종을 손으로 바꿨다면(그 지역·그룹에서 마지막 적용 이후 업종 클릭이 있었으면) 덮어쓰지 않는다.
- **꺼짐 상태**: 업종을 건드리지 않는다. 문구를 숨긴다. `weather.badge`가 비어 있지 않으면 토글 옆에 배지를 보여준다.
- **끄는 순간**: `state.categories.clear()` → `syncCategoryChips()`. 업종을 [전체]로 되돌린다(설계 8절 3번).
- **가이드**
  - 처음 켤 때 `lunch-selector:recommend-guide-seen`이 없으면 띄운다.
  - [확인]을 누르면 키를 저장하고 닫는다. Esc로도 닫힌다.
  - 저장소를 못 쓰는 환경에서는 매번 떠도 괜찮다.
- **저장**: `lunch-selector:recommend` = `on`/`off`. 없으면 꺼짐. 기존 `storage` 헬퍼만 쓴다.
- **돌리는 중·다시보기 중**: 토글 버튼도 `setControlsDisabled`에서 다른 칩과 같이 비활성화한다.
- **접근성**: 토글은 `button` + `aria-pressed`. 문구 영역은 바뀔 때 스크린리더가 읽도록 기존 `announce`를 쓰거나 `aria-live="polite"`를 둔다. 배지는 장식이 아니므로 텍스트 그대로 둔다.

### 부가 (서버, 사소)
- `server/app.js`의 `regionWarnings` 맵에 상한을 둔다(예: 200개를 넘으면 가장 오래된 것부터 지움). 테스트를 1개 추가한다. 027 적대검증에서 나온 사소 항목이다.

### 하지 말 것
- 추첨(`select.js`), 정기휴무, 별점·등급, 제외, 연출(`reveal*.js`, `animation.js`), 지도, 카페 모드 동작은 바꾸지 않는다.
- `js/config.js`의 기존 운영 값과 `APP_VERSION`을 바꾸지 않는다. 버전은 릴리스 때 PM이 올린다.
- 의존성을 추가하지 않는다. **실제 구글 폼 전송 금지**(가짜 폼·가짜 CSV로 확인).
- 운영 서버 주소를 코드에 넣지 않는다.
- 커밋하지 않는다.

### DoD
- F-1 단위 테스트 (`tests/recommend.test.js`)
  - `parseRecommendation`: 정상, `ok:false`, 필드 누락·타입 오류 각각, 모르는 필드 무시
  - `fetchRecommendation`: 200 정상, 404/503, JSON 오류, 시간 초과(가짜 fetch + 가짜 시계 또는 짧은 timeout)에서 각각 `null`, 예외 없음
  - `pickVisibleCategories`: 순서 유지, 빈 교집합
  - `buildRecommendUrl`: 한글 인코딩
  - `formatUpdatedAt`: `2026-11-26T01:30:00.000Z` → `10:30`, `2026-11-26T15:05:00Z` → `00:05`
- F-2 Chrome 확인. 저장소 밖 복사본에서 가짜 CSV와 **로컬 `server/`(classifier off) 또는 가짜 추천 서버**를 쓴다. 날씨 조건별로 응답을 바꿔야 하면 가짜 서버를 쓴다.
  - 비·더움·무난 응답 각각에서 꺼짐 상태 배지가 있는지 없는지
  - 켜면 업종이 자동으로 켜짐 + 문구와 시각
  - 그룹을 바꿨을 때 보이는 업종만 켜짐
  - 지역을 바꿨을 때 그 지역 응답으로 다시 적용
  - 끄면 [전체]로 돌아감
  - 새로고침해도 켜짐 유지
  - 가이드: 처음 켤 때 한 번, 다시 켤 때는 안 뜸
  - 카페 모드에서는 줄이 숨겨짐
  - 서버를 끄거나 3초 넘게 지연시키면 줄이 숨겨지고 룰렛은 정상 동작
  - `RECOMMEND_URL`이 비면 줄이 아예 없음
  - 360px 폭과 다크 테마
  - 스크린샷을 `docs/agents/screenshots/028/`에 둔다(기존 관례).
- F-3 회귀 없음: 돌리기, 연출, 다시보기, 제외, 평가 창(가짜 폼), 지도, 모드 전환
- F-4 `npm test` 전부 PASS(027의 135 + 신규), `git diff --check`, 버전 테스트 통과(bump 반영)
- 끝나면 아래 "구현 보고 1차"를 채우고 worklog에 한 줄을 남긴다. 그다음 `herdr agent prompt lunch-selector-claude "[from lunch-selector-codex] 028 구현 1차 완료. docs/agents/handoffs/028-recommend-frontend.md"`. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

### 변경 파일

- `index.html`, `css/style.css`, `js/app.js`, `js/config.js`, `js/recommend.js`
- `server/app.js`, `tests/recommend.test.js`, `tests/server-app.test.js`
- `js/animation.js`, `js/data.js`, `js/reveal.js`, `js/select.js`에는 bump의 버전 참조를 반영했다.
- `README.md`, `docs/SETUP.md`, `docs/agents/screenshots/028/`, 이 인계서, `docs/agents/worklog.md`

### 셀프리뷰

- F-1 `tests/recommend.test.js` 7개 통과. 응답 계약 및 잘못된 값, HTTP·JSON·네트워크 오류, 본문 제한 시간 및 요청 취소, 화면 순서 교집합, 한글 URL, UTC에서 서울 시각 변환을 검증했다. 서버의 모르는 지역 로그 상한 테스트 1개도 통과했다.
- F-2 저장소 밖의 복사본에서 Chrome for Testing 159와 Playwright로 검증했다. 가짜 게시 CSV와 로컬 추천 API를 사용했다. 비·더위 배지, 무난 상태, 서울 시각, 켜기·끄기, 지역·그룹별 자동 선택, 새로고침 뒤 설정 유지, 가이드 최초 노출과 확인·Esc, 모드 전환, 성공·실패 캐시, 응답 전 수동 업종 선택 보호와 늦은 지역 응답 무시를 확인했다. 3.6초 응답 지연·503·빈 주소에서도 추천 줄이 숨고 룰렛이 정상 동작했다. 360px 다크 테마는 가로 넘침이 없었다.
- F-3 Chrome에서 돌리기, 상위 등급 연출, 다시보기, 연출 중 토글 비활성화, 제외 저장, 평가 창과 별점 1건 전송, 지도 핀 2개, 점심·카페 전환을 확인했다. 폼과 지도 SDK는 테스트용으로 대체했다.
- F-4 `npm run bump` 버전 `221ad35250fc`를 반영했다. `npm test` 143개, `node --test tests/version.test.js` 3개, `git diff --check` 통과.
- 증거는 [스크린샷 9장](../screenshots/028/)에 있다.

### 설계와 달라진 점 / 판단한 점

- 지역별로 요청 Promise를 캐시해 같은 지역의 진행 중 요청과 성공·실패 결과를 공유한다. 응답의 지역 값이 요청과 다르면 실패로 처리한다.
- Esc로 가이드를 닫을 때도 확인과 같은 저장 키를 기록한다. 기존 모달이 열려 있는 동안에는 그 모달의 Esc 동작이 우선한다.
- `RECOMMEND_URL` 기본값은 빈 문자열로 두었다. `APP_VERSION`과 기존 운영 값은 유지했다.

### 미해결·확인 필요

- 실제 추천 서버 주소 설정과 배포 후 HTTPS·CORS 연결은 사용자 환경에서 확인한다.

## 수정 지시 1/2 (PM)
- 근거: reviewer 리뷰와 supervisor 적대검증(2026-11-26). 차단 결함은 없고 DoD F-1~F-4는 충족됐다. 아래 항목만 고친다. 통과한 동작은 바꾸지 않는다: 표시 조건, 지역별 캐시, 늦은 응답 버리기, manualSelection 보호, 켜고 끌 때 resetResult, 가이드 Esc 우선순위, recommend.js 계약, 금지 사항.

### 지적 사항
- **N-1 [중요] 늦게 온 응답이 결과 화면과 어긋남** (`js/app.js:481-487`, `688-714`)
  - 처음 도착한 응답을 적용하는 지점(`loadRecommendation`의 응답 처리)에서 다음 중 하나라도 해당하면 **업종에 적용하지 않고** `manualSelection = true`로 처리한다.
    - `state.spinning`
    - `state.replaying`
    - **결과 카드가 이미 떠 있는 상태**(돌리기를 한 번 끝낸 뒤 `resetResult` 전). 판정 방법은 기존 상태 값에서 고르고 보고에 적는다.
  - 문구, 배지, 상세 줄 표시는 그대로 갱신한다. 업종 칩과 `state.categories`만 건드리지 않는다.
  - 이 경로에서 `resetResult()`를 부르지 않는다. 회전 중이면 연출이 깨지고, 보고 있던 결과가 사라진다.
  - 이후 사용자가 지역·그룹을 바꾸거나 토글을 다시 켜면 지금처럼 다시 적용된다.
- **N-2 [중요] 스크린리더 알림** (`#recommend-message`, `app.js:467-479`)
  - 켜짐 상태에서 문구가 새로 표시되거나 바뀔 때 기존 `announce` 요소(`#announce`)에도 같은 문구를 넣는다. 예: "AI 메뉴 추천: 비 오는 날엔 국물이나 튀김 어때? 업종 N개를 켰어요"
  - 적용하지 않은 경우(N-1)는 "업종 N개를 켰어요"를 빼고 넣는다.
  - `#recommend-message`의 `aria-live`는 빼서 두 번 읽히지 않게 한다.
- **N-3 [사소] 가이드가 확인 없이 사라지면 다시 뜸** (`app.js:477`)
  - 가이드를 **띄우는 순간** `recommend-guide-seen`을 저장한다. [확인]·Esc는 닫기만 한다.
  - 결과가 바뀌거나 지역을 바꿔도 가이드는 닫지 않는다. 닫히는 경우는 [확인], Esc, 토글 끄기, 그리고 추천 줄이 숨겨지는 경우(카페 모드, 실패)뿐이다.
- **N-4 [사소] 자정 표기** (`js/recommend.js:3`): `Intl.DateTimeFormat` 옵션에 `hourCycle: 'h23'`을 추가한다. 기존 테스트 `00:05`를 유지한다.
- **N-5 [사소] 캐시된 지역을 다시 고를 때 줄 깜빡임**: 그 지역의 결과가 이미 resolve된 값으로 있으면, 숨기지 않고 바로 그 값으로 그린다. 결과 값을 동기로 읽을 수 있는 작은 Map을 같이 둬도 된다.

### DoD (수정 1회차)
- 기존 F-1·F-4 유지: `npm test` 전부 PASS, `git diff --check`, bump 반영, 버전 테스트.
- 가능한 부분은 순수 함수로 빼서 단위 테스트한다. 예: N-1의 "적용할지" 판정, N-2의 알림 문구 조립.
- Chrome 재확인(저장소 밖 복사본, 가짜 CSV·가짜 서버)
  - N-1: 추천 응답을 2.5초 지연시킨 상태에서 즉시 돌리기를 누른다. 회전 중 도착해도 칩이 그대로이고 결과와 칩이 일치해야 한다. 돌리기가 끝난 뒤 도착해도 마찬가지다. 그 뒤 그룹을 바꾸면 다시 적용된다.
  - N-2: `#announce` 텍스트가 바뀌는 것을 확인한다(DOM 확인으로 충분).
  - N-3: 가이드가 뜬 상태에서 지역을 바꿔도 유지되고, 새로고침 뒤 다시 켜면 안 뜬다.
  - N-5: 캐시된 지역으로 돌아갈 때 줄이 숨겨지지 않는다.
  - 회귀: 돌리기, 연출, 다시보기, 모드 전환.
  - 필요한 스크린샷만 `docs/agents/screenshots/028/`에 추가한다.
- 끝나면 아래 "구현 보고 2차"를 채우고 worklog에 한 줄을 남긴다. 그다음 `herdr agent prompt lunch-selector-claude "[from lunch-selector-codex] 028 수정 1/2 완료. docs/agents/handoffs/028-recommend-frontend.md"`. 커밋하지 않는다.

## 구현 보고 2차 (코덱스)

### 변경 파일

- `js/app.js`, `js/recommend.js`, `index.html`, `tests/recommend.test.js`, `README.md`
- `js/animation.js`, `js/data.js`, `js/reveal.js`, `js/select.js`에 bump 버전 참조를 반영했다.
- 인계서, 작업 기록, `docs/agents/screenshots/028/`의 추가 이미지 2장

### 셀프리뷰

- `npm run bump` 버전 `032cfc5d7115` 적용. `npm test` 144개, `node --test tests/version.test.js` 3개, `git diff --check` 통과.
- 저장소 밖 복사본에 가짜 CSV·추천 API를 연결해 Chrome for Testing 159에서 검증했다. 회전 중과 결과 공개 후 각각 2.5초 지연 응답을 받아도 기존 칩·연출·카드가 유지됐다. 이후 그룹을 바꾸면 새 그룹에 추천이 적용됐다.
- `#announce`는 추천을 적용하면 업종 수를 읽고, 기존 선택을 보존하면 추천 문구만 읽는 것을 DOM에서 확인했다. 가이드가 새 지역의 요청 중과 성공 후에 유지되고 새로고침 후 다시 켜도 뜨지 않았다. 캐시된 지역으로 돌아갈 때 `MutationObserver`로 추천 줄의 `hidden` 변경이 없음을 확인했다.
- 돌리기, 상위 연출, 다시보기, 추천 토글 비활성화, 점심·카페 전환을 다시 확인했다. 수동 업종 보호, 늦은 지역 응답 무시, 3초 초과·503·빈 주소, 다크 360px, 가짜 지도·평가와 제외 흐름도 통과했다.
- [늦은 응답 뒤에도 유지된 결과](../screenshots/028/10-late-recommendation-keeps-result.png), [지역 변경 뒤 유지된 가이드](../screenshots/028/11-guide-after-region-change.png)

### 지적 사항별 반영

- N-1 `js/app.js`의 `loadRecommendation`에서 회전·다시보기 상태 또는 카드의 `revealed` 클래스를 확인한다. 이 클래스는 결과를 공개할 때 붙고 `resetResult`에서 제거된다. 대기 중이던 응답이 이 상태에 도착하면 문구만 갱신하고 업종은 수동 선택 상태로 보호한다.
- N-2 `#announce`에 보여준 추천 문구를 넣고 기존 추천 문구 영역의 `aria-live`를 제거했다. 순수 함수 테스트 ‘추천 안내는 실제로 적용한 경우에만 적용 업종 수를 읽는다’에서 두 문구를 검증했다.
- N-3 가이드 표시 시점에 읽음 상태를 저장한다. 지역의 요청이 진행 중일 때 가이드를 유지하고, 요청 실패나 카페 전환, 토글 끄기, 확인·Esc로 닫는다.
- N-4 `hourCycle: 'h23'`으로 서울 시각을 표시한다. `hour12` 옵션은 `hourCycle`을 덮어쓰므로 제거했다. 기존 단위 테스트의 `00:05`가 통과했다.
- N-5 지역별 캐시 항목에 Promise와 완료 결과를 같이 저장한다. 결과가 있으면 추천 줄을 숨기는 중간 상태 없이 동기로 적용한다.

### 미해결·확인 필요

- 실제 추천 서버 주소를 넣은 뒤 운영 환경의 HTTPS·CORS 연결을 확인한다.
