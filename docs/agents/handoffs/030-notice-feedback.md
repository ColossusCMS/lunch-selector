# 030 공지 팝업 · AI 추천 피드백 · 출처 표시 (프론트, v2.5)

## 지시 (PM)
- 설계서: `docs/design/2026-11-26/ai-recommend-v2-beta-design.md` (합의 완료). **4·5·6절과 7절의 프론트 테스트가 이번 범위다.** 설계서와 이 지시서가 다르면 이 지시서를 따르고 보고에 적는다.
- 앞선 작업: 029(서버, 응답에 `source` 추가). 이 작업은 029가 끝난 뒤 시작한다. 단 **`source`가 없는 v2.4 서버 응답에서도 동작해야 한다**(없으면 `rule`).
- 회차: 최초.
- 기존 테스트: 165개(029 완료 시점).

### 목표
1. 추천 문구 아래 작은 글씨를 출처(`ai`/`rule`)에 따라 바꾼다.
2. 구글 시트 `공지관리` 탭의 공지를 접속 시 팝업으로 차례로 띄운다.
3. AI 추천 피드백 모달을 만든다. AI 추천이 켜진 채 결과가 처음 나올 때 한 번 자동으로 띄우고, footer 버튼으로 언제든 연다.
4. v2.5 릴리스 준비(`APP_VERSION`, README 배지, `docs/SETUP.md`, `npm run bump`).

### 하지 말 것
- `server/`는 고치지 않는다.
- 별점 기능의 동작·저장 키·폼은 바꾸지 않는다(별 버튼 UI와 스타일은 재사용해도 된다). 별점 카드를 띄우는 시점 조건에 "공지가 열려 있지 않음"만 더한다.
- 공지 내용을 HTML로 해석하지 않는다(`innerHTML` 금지, 모두 `textContent`).
- **실제 구글 폼으로 전송하지 않는다.** 화면 확인 때는 `fetch`를 가로채 본문만 확인한다. 실제 시트 CSV는 읽어도 되지만, 확인에는 가짜 CSV를 쓰는 것을 권장한다.
- 커밋하지 않는다.

### 설정 (`js/config.js`)
```js
export const NOTICE = { gid: '580874591' };   // 시트 '공지관리' 탭. 비우면 공지 기능 꺼짐
export const FEEDBACK = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSecWJzqrdzrhN0CgldgdqiHmkfPsq7QZvJQJbfYA8v1_EnyeQ/formResponse',
  entries: {
    feature: 'entry.1410298134',   // AI 추천 기능은 어떤가요? (1~5)
    result: 'entry.212274172',     // 추천 결과가 마음에 드나요? (1~5)
    comment: 'entry.1590812819',   // 피드백·제안 (자유, 최대 500자)
    region: 'entry.843951537',
    weather: 'entry.129957015',
    categories: 'entry.1251237933',
    source: 'entry.341670665',     // ai | rule | off
    store: 'entry.577077389',
    version: 'entry.512805220',
  },
};
export function feedbackEnabled(feedback) { /* ratingEnabled와 같은 방식: formUrl과 9개 entry가 모두 비어 있지 않은 문자열 */ }
```
- 공지 CSV 주소: `${PUBLISH_URL}?gid=${NOTICE.gid}&single=true&output=csv`. `PUBLISH_URL`이 비어 있으면 공지 기능을 끈다.

### 1. 출처 표시 (설계서 4절)
- `parseRecommendation`이 `source`를 읽는다. `"ai"`가 아니면 모두 `"rule"`.
- 작은 글씨:
  - `ai`: `🤖 AI 추천 · <지역> 점심시간 날씨 기준 · <HH:mm> 갱신` (지금과 같음)
  - `rule`: `날씨 기준 · <지역> 점심시간 날씨 · <HH:mm> 갱신`
- 가이드 카드 첫 줄: `AI가 오늘 날씨를 보고 어울리는 업종을 골라 켜줘요`.
- v2.4 남은 사소 항목: 추천 업종이 지금 화면에 하나도 없을 때(교집합 0개) 낭독을 "업종 0개를 켰어요" 대신 `추천 업종이 지금 화면에 없어요`로 바꾼다. `formatRecommendationAnnouncement` 테스트를 고친다.

### 2. 공지 팝업 (설계서 5절)
새 모듈 `js/notice.js` (DOM 없는 순수 함수 중심):
- `parseNotices(rows)`: CSV 행 배열 → 공지 배열.
  - 1행 열 이름으로 찾는다. 이름은 trim 하고 영문은 대소문자를 가리지 않는다. 실제 시트 1행은 `ID,사용,시작일,종료일,제목,내용,버튼,링크`다.
  - 필수 열(`ID`·`사용`·`시작일`·`제목`·`내용`) 중 하나라도 없으면 빈 배열.
  - 행 규칙: `ID`는 trim 후 `^[A-Za-z0-9-]{1,40}$`, `사용`은 trim·대문자화 후 `TRUE`·`O`·`Y`이면 사용, `시작일`·`종료일`은 `YYYY-MM-DD`이고 실제 있는 날짜, `제목`·`내용`은 trim 후 비어 있지 않음. 하나라도 어기면 그 행은 버린다. 종료일은 비어도 된다(계속). 종료일이 시작일보다 앞이면 버린다.
  - `링크`는 `https://`로 시작하고 `new URL`로 읽히면 인정, 아니면 버튼째 없앤다. `버튼`이 비었는데 링크가 있으면 버튼 문구는 `자세히 보기`.
  - 같은 `ID`가 여러 행이면 아래쪽 행만 남긴다.
  - 시트에는 체크박스만 깔린 빈 행(`,FALSE,,,,,,`)이 1,000줄쯤 있다. 빠르게 건너뛴다.
  - 각 공지에 시트 행 순서(`row`)를 남긴다.
- `todayInSeoul(now)`: `YYYY-MM-DD` (Asia/Seoul).
- `activeNotices(notices, today, hidden, { limit = 3 })`: 사용 중, `시작일 ≤ today`, (종료일 없음 또는 `today ≤ 종료일`), 숨김 아님. 정렬은 시작일 내림차순, 같으면 `row` 내림차순. 앞 `limit`개.
- `readHidden(raw, today)`: 저장값 해석. `{ "<id>": "forever" | "YYYY-MM-DD" }`에서 날짜가 `today`와 다른 항목은 지운다. 형식이 틀리면 `{}`. 정리된 객체를 돌려준다(바뀌었으면 호출 측에서 다시 저장).
- `hideNotice(hidden, id, kind, today)`: `kind`가 `today`면 `today`를, `forever`면 `"forever"`를 넣은 새 객체.

화면(`js/app.js` + `index.html` + `css/style.css`):
- `<dialog id="notice-dialog" class="rating-dialog notice-dialog" aria-labelledby="notice-title">`를 추가한다. 스타일은 별점 카드에 맞춘다.
- 구성: 닫기 `✕`(오른쪽 위, `aria-label="닫기"`), 제목(공지가 2개 이상이면 제목 옆에 작은 글씨 `1/3`), 내용(셀 안 줄바꿈 유지 — `white-space: pre-line`), 링크 버튼(있을 때만, `target="_blank" rel="noopener"`), 아래 버튼 `오늘 하루 안 보기` · `다시 띄우지 않기`.
- 동작:
  - 페이지 로드 때 한 번 공지 CSV를 읽는다(`fetchCsvRows`, 가게 목록 로딩을 막지 않음). 실패하면 조용히 무시한다(`console.warn`만).
  - 표시 조건: 다른 dialog(`rating`·`exclude`·`reveal`)가 열려 있지 않고, 회전·다시보기 중이 아니다. 조건이 안 맞으면 조건이 풀릴 때 다시 시도한다(최소한 회전·다시보기가 끝난 뒤와 다른 dialog가 닫힌 뒤).
  - `오늘 하루 안 보기`·`다시 띄우지 않기`: 저장하고 닫는다. `✕`·Esc: 저장 없이 닫는다. 어느 쪽이든 닫히면 다음 공지를 띄운다. 마지막 공지를 닫으면 `initRatings()`를 다시 불러 별점 카드 조건을 확인한다.
  - 저장 키: `lunch-selector:notice-hidden`. 기존 `storage` 헬퍼(try/catch)를 쓴다.
  - 공지가 열려 있는 동안 `initRatings()`는 카드를 띄우지 않는다(`dialogOpen` 판정에 공지 dialog를 넣는다).
  - 같은 페이지 방문 중에는 공지를 한 번만 돌린다(탭 전환·visibilitychange로 다시 띄우지 않는다).

### 3. 피드백 모달 (설계서 6절)
새 모듈 `js/feedback.js` (DOM 없는 순수 함수 중심):
- `buildFeedbackBody(entries, data)`: `URLSearchParams`. `feature`·`result`는 `1`~`5` 문자열, `comment`는 trim 후 500자(코드포인트)까지, 나머지는 그대로. 빈 값도 키는 넣는다.
- `formatWeatherSummary(weather)`: 추천 응답의 `weather`로 `비 · 체감 3~6℃ · 강수 80%` 같은 문자열. 분류는 배지 우선순위와 같게(rain→hot→cold, 눈 배지면 `눈`), 없으면 `무난`. 수치가 `null`이면 그 부분을 뺀다. 응답이 없으면 빈 문자열.
- `shouldAutoPrompt({ enabled, recommendOn, mode, prompted })`: 피드백 설정이 켜져 있고, 추천이 켜져 있고, 점심 모드이고, 아직 자동 표시하지 않았으면 `true`.
- `feedbackContext(...)`: 아래 맥락 값을 조립(구현 방식 재량, 테스트 가능하게).

맥락 값:
| 키 | 값 |
|---|---|
| `region` | 현재 선택 지역 |
| `weather` | 현재 지역 추천 응답의 `formatWeatherSummary`(응답 없으면 빈 값) |
| `categories` | 현재 지역 추천 응답의 `categories`를 `, `로 이음(없으면 빈 값) |
| `source` | 추천이 꺼져 있으면 `off`, 켜져 있으면 응답의 `source`(응답 없으면 빈 값) |
| `store` | 이번 페이지에서 마지막으로 나온 결과의 1순위 가게 이름(없으면 빈 값) |
| `version` | `APP_VERSION` |

화면:
- `<dialog id="feedback-dialog" class="rating-dialog feedback-dialog" aria-labelledby="feedback-title">`.
- 구성: `✕`, 제목 `🤖 AI 추천 어땠어요?`, 작은 글씨 `베타 기능이라 의견이 큰 도움이 돼요`, 질문 1 `AI 추천 기능은 어떤가요?` + 별 5개, 질문 2 `추천 결과가 마음에 드나요?` + 별 5개, 질문 3 `피드백이나 제안이 있으면 적어주세요 (선택)` + `<textarea maxlength="500">`, 버튼 `나중에` · `보내기`.
- 별 버튼은 별점 카드와 같은 모양·동작(`aria-pressed`, 다시 누르면 해제, `starLabel` 표시)을 쓴다. 가능하면 별 버튼 만드는 부분을 함수로 빼서 두 곳에서 같이 쓴다. 별점 카드의 동작이 바뀌지 않게 주의한다.
- 질문 1·2를 모두 골라야 `보내기`가 켜진다.
- 전송: `fetch(FEEDBACK.formUrl, { method: 'POST', mode: 'no-cors', body })`. 보내는 동안 버튼을 막는다. 성공(예외 없음)하면 `고마워요! 의견 잘 받았어요`를 보이고 3초 뒤 또는 `닫기`로 닫는다. 예외면 `보내지 못했어요. 잠시 뒤 다시 시도해 주세요`를 보이고 입력값을 유지한 채 다시 보낼 수 있게 한다.
- 자동 표시:
  - `present()`에서 결과가 확정된 뒤(`unveiled` 처리 이후, 같은 `round`일 때) `shouldAutoPrompt`가 참이면 띄운다.
  - 띄우는 순간 `lunch-selector:feedback-prompted` = `1`을 저장한다. 보내든 닫든 다시 자동으로 뜨지 않는다.
  - 다른 dialog가 열려 있으면 그 dialog가 닫힌 뒤로 미룬다. 미루는 중 다시 돌리기를 시작하면 이번 자동 표시는 취소한다(다음 결과 때 다시 판단).
- footer 버튼: `✏️ 가게 목록 편집하기` 위에 `<button id="feedback-open" type="button" class="feedback-link">🤖 AI 추천 피드백</button>`. `feedbackEnabled(FEEDBACK)`이고 `RECOMMEND_URL`이 있으면 모드와 상관없이 보인다. 회전·다시보기 중에는 열지 않는다.
- 공지 팝업과 겹치면 공지가 먼저다(공지가 열려 있으면 피드백 자동 표시는 미룬다).

### 4. 릴리스 준비
- `APP_VERSION = 'v2.5'`, README 배지 v2.5.
- `docs/SETUP.md`:
  - "공지 팝업" 절: `공지관리` 탭 열 구성 표, 체크박스 만드는 법(삽입 → 체크박스), 기간 규칙(한국 날짜, 종료일 포함), 여러 개면 최신 시작일부터 최대 3개를 차례로, 숨김은 ID 기준이라 새 공지는 새 ID, 반영에 몇 분 걸림, 게시 내용은 공개, `NOTICE.gid` 설정.
  - "AI 추천 피드백" 절: 폼 질문 9개(모두 단답형·필수 아님), 이메일 수집·로그인 요구 끄기, 미리 채워진 링크로 entry 찾기, `FEEDBACK` 설정, 폼에 필수 질문을 추가하면 전송이 조용히 실패한다는 경고.
- README 기능 소개에 공지·피드백을 한두 줄 더한다.
- 마지막에 `npm run bump`.

### 완료 조건 (DoD)
- 테스트(`tests/notice.test.js`, `tests/feedback.test.js` 새 파일, `tests/recommend.test.js` 보강):
  - `parseNotices`: 실제 시트 1행(`ID` 대문자) 인식, 열 순서 무관, 필수 열 없음 → 빈 배열, 빈 체크박스 행 무시, `사용` 값(`TRUE`/`FALSE`/`O`/`Y`/`0`/`1`/빈 값), 날짜 형식·없는 날짜(`2026-02-30`)·종료일<시작일, 잘못된 ID, `https://` 아닌 링크, 버튼 문구 기본값, 같은 ID 중복, 셀 안 줄바꿈 유지.
  - `activeNotices`: 시작일 당일 포함, 종료일 당일 포함, 종료일 없음, 숨김(`forever`/오늘), 정렬(시작일·row), 상한 3.
  - `todayInSeoul`: 서울 자정 경계(UTC 14:59/15:00).
  - `readHidden`/`hideNotice`: 지난 날짜 정리, 깨진 값, 불변성.
  - `feedbackEnabled`, `buildFeedbackBody`(entry 매핑, 500자 자르기, 빈 값 키 유지), `formatWeatherSummary`(분류별, 눈, null 수치, 응답 없음), `shouldAutoPrompt`.
  - `parseRecommendation`의 `source`(없음·`ai`·이상한 값), 바뀐 낭독 문구.
- `npm test` 전체 통과. `tests/version.test.js` 포함. 실행한 명령과 결과를 보고에 그대로 적는다.
- 화면 확인(Chrome, `npx serve -l 5173 .`, 가짜 공지 CSV·가짜 추천 응답·`fetch` 가로채기로): 스크린샷을 `docs/agents/screenshots/030/`에 남긴다.
  - 공지 3개 차례 표시(`1/3`→`2/3`→`3/3`), 오늘 하루 안 보기·다시 띄우지 않기 뒤 새로고침, 링크 버튼, 공지 닫은 뒤 별점 카드가 뜨는 경우.
  - 피드백: 첫 AI 결과 뒤 자동 표시, 다음 결과 때 안 뜸, footer 버튼, 별 미선택 시 보내기 꺼짐, 전송 본문(가로챈 값), 실패 메시지.
  - 출처 글씨 `ai`/`rule`, 모바일 폭(390px)과 다크 테마에서 공지·피드백 모달.

### 주의
- 운영 시트의 `ai-beta-1` 공지는 지금 `사용`이 FALSE다. 배포 때 사용자가 체크한다. 화면 확인에 운영 공지를 쓰지 않는다.
- 모든 새 모듈은 `npm run bump` 대상이다. import 경로에 `?v=`가 붙는 기존 관례를 따른다.
- 접근성: dialog는 기존처럼 `showModal()`, 첫 포커스는 닫기 외의 첫 조작 요소(공지: 첫 버튼, 피드백: 질문 1의 첫 별). Esc는 브라우저 기본 cancel로 닫는다.
- 공지 CSV 실패·느림이 룰렛 로딩과 버튼 활성화를 막으면 안 된다.

## 완료 보고 (Codex)

### 변경 파일

- `js/notice.js`, `js/feedback.js`, `js/dialogs.js`, `js/recommend.js`, `js/config.js`, `js/app.js`, `index.html`, `css/style.css`
- `js/animation.js`, `js/data.js`, `js/reveal.js`, `js/select.js`의 버전 참조
- `tests/notice.test.js`, `tests/feedback.test.js`, `tests/recommend.test.js`, `README.md`, `docs/SETUP.md`, 인계서, 작업 기록, [스크린샷 6장](../screenshots/030/)

### 셀프리뷰

- `npm run bump` 버전 `9a2997c44623` 적용. `npm test` 176개(기존 165개, 신규 11개), `node --test tests/version.test.js` 3개, `git diff --check` 통과.
- 저장소 밖 복사본에서 `npx --yes serve -l 5173 .`로 실행하고 Chrome for Testing 159에서 가짜 CSV·추천 응답을 사용했다. 390px 다크 화면에서 공지와 피드백을 확인했다.
- 공지 세 건의 순서 표시, 링크 새 창과 포커스, 공지 문자열의 줄바꿈·HTML 문자 그대로 표시, 오늘 및 영구 숨김 후 새로고침, 마지막 공지 뒤 기존 별점 카드 표시를 검증했다.
- 추천의 AI 및 v2.4 호환 규칙 출처, 빈 교집합 안내, 첫 결과 피드백 자동 표시와 다음 결과 미표시, 카페 모드 footer 버튼, 별 토글·필수 입력, 전송 실패 후 동일 입력 재시도, 성공 후 자동 닫힘을 확인했다.
- 가로챈 피드백 POST 2건(실패·재시도)에서 9개 필드를 검증했다. 성공 본문의 내용은 기능 4점, 결과 5점, 의견 `좋아요`, 지역 `검암`, 날씨 `비 · 체감 3~6℃ · 강수 80%`, 업종 `국밥`, 출처 `ai`, 가게 `든든국밥`, 버전 `v2.5`였다. 외부 요청은 모두 브라우저 라우팅에서 처리했다.
- 공지 CSV를 1.25초 지연시켜 룰렛이 먼저 동작하고 피드백은 공지 뒤에 열린다는 것을 확인했다.

### 판단한 점

- 공지 로딩 동안 가게 목록·룰렛·평점 데이터 조회를 진행한다. 모달 표시만 공지 확인 뒤로 미뤄 기존 별점과 자동 피드백보다 공지를 우선한다.
- 동일 ID의 아래쪽 행이 비활성이거나 유효하지 않으면 앞선 행도 표시하지 않는다. 기존 별점과 피드백의 별 버튼은 동일한 생성 함수를 공유한다.
- 마지막 1순위 가게는 페이지 메모리에 보관한다. 피드백 창을 열 때 현재 지역의 추천 정보와 함께 폼 맥락을 확정한다.

### 미해결·확인 필요

- 운영 공지 활성화 및 실제 배포 환경 확인은 사용자 작업이다.

## 수정 지시 1/2 (PM)
- 검수 결과: reviewer는 Must 없음, supervisor는 적대검증 PASS·DoD 충족. 아래 작은 수정만 반영한다.

| 번호 | 위치 | 기대 동작 |
|---|---|---|
| Q-1 | `js/dialogs.js:126-131` | 피드백 전송 실패로 입력을 다시 풀 때 `보내기` 버튼에 포커스를 돌려준다. |
| Q-2 | `js/dialogs.js:120-123` | 성공·실패 문구가 화면 낭독기에 읽히게 한다. `role="status"` 요소를 먼저 DOM에 둔 뒤 텍스트를 넣는다(별점 카드의 방식과 맞춘다). |
| Q-3 | `js/app.js` 공지 로딩 | 공지 CSV에 4초 제한을 준다(`fetchCsvRows(url, fetch, { timeout: 4000 })`). 공지 때문에 별점 카드·피드백이 최대 10초 밀리지 않게 한다. |
| Q-4 | `js/notice.js` `readHidden` | 항목 하나가 잘못돼도 전체를 버리지 않는다. 값이 `"forever"`나 `YYYY-MM-DD`가 아닌 항목과 ID 규칙에 안 맞는 키만 버리고 나머지는 유지한다. 최상위가 객체가 아니거나 JSON이 깨졌을 때만 `{}`. 테스트 추가. |
| Q-5 | `js/app.js` `flushDialogs` | 그 안에서 부르는 `initRatings()`를 try/catch로 감싸 예외가 처리 안 된 Promise 예외가 되지 않게 한다(`console.warn`). |
| Q-6 | `README.md:16` | 테스트 배지를 실제 통과 개수로 갱신한다. |

- 마지막에 `npm run bump`. DoD: `npm test` 전체 통과, 실행 명령과 결과를 아래 보고에 추가.

## 수정 보고 1/2 (Codex)

- Q-1 실패 후 입력을 다시 활성화하고 `보내기`에 포커스를 돌려준다.
- Q-2 성공과 실패 모두 처음부터 연결된 동일한 `role="status"` 노드에 문구를 쓴다. Chrome에서 성공·실패 시 동일 노드와 실패 후 버튼 포커스를 확인했다. 화면 낭독기 자체 청취는 확인하지 않았다.
- Q-3 공지 요청과 본문 읽기에 4초 제한을 적용했다. 응답을 6.5초 지연시킨 가짜 CSV에서 대기하던 별점 창이 브라우저 시작 후 4.49초에 표시됐다.
- Q-4 정상 숨김과 손상 항목이 섞인 저장값에서 유효한 숨김만 유지한다. 테스트 ‘숨김 저장값에서 잘못된 항목만 제거하고 정상 숨김은 유지한다’를 추가했다.
- Q-5 공지 처리 뒤 호출하는 `initRatings()` 예외를 경고로 남긴다. Chrome에서 가짜 예외를 주입해 경고와 이후 피드백 열기를 확인했다.
- Q-6 README의 테스트 배지와 개수를 177로 갱신했다.
- `npm run bump` 버전 `a5dc0fabb610` 적용. `npm test` 177개, `node --test tests/version.test.js` 3개, `git diff --check` 통과. 저장소 밖 복사본의 Chrome 가짜 데이터 점검도 다시 통과했다.
