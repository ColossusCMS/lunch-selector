# 026 탭으로 돌아왔을 때 평가 창 다시 확인 (H-5)

## 지시 (PM)
- 출처: `docs/handoff/2026-11-05/maintenance-issues.md` H-5. 025 다음 작업이다. 025는 아직 커밋 전이므로 그 위에 이어서 한다.
- 재현(2026-11-05 사용자, 실제 휴대폰): 돌린 뒤 탭을 닫지 않고 나갔다가 30분 넘게 지나 돌아오면 **평가 창이 뜨지 않는다**.
- 원인: `js/app.js`의 `initRatings()`는 시작할 때 한 번만 실행된다(782행). 평점 CSV 읽기와 `pickStatus` 확인도 그때만 한다. `visibilitychange`·`pageshow` 처리가 없다.

### 바꿀 것
- 화면이 다시 보일 때(`visibilitychange`에서 `document.visibilityState === 'visible'`, 그리고 bfcache 복원 `pageshow`에서 `event.persisted`) 평가 조건을 다시 확인한다. 확인 방법은 시작할 때와 같다(`parsePick` → `pickStatus` → `drop`이면 지우고 `ask`이면 `showRatingCard`).
- 다음 경우에는 건너뛴다(다음에 다시 보일 때 다시 확인한다):
  - 평가가 꺼져 있음(`ratingsOn` false)
  - 돌리는 중·다시보기 중(`state.spinning`, `state.replaying`)
  - 열려 있는 창이 있음: `ratingDialog`·`excludeDialog`·`revealDialog` 중 하나라도 `open`(평가 창이 이미 떠 있으면 두 번 띄우지 않는다)
- 평점 CSV(`RATING.csvUrl`)도 다시 읽어 `state.ratings`를 바꾼다. 다만 마지막으로 읽은 지 **5분이 안 됐으면 건너뛴다**(게시 CSV 반영 주기가 5분이라 그보다 자주 읽어도 의미 없음). 실패해도 기존 값을 유지하고 `console.warn`만 남긴다. 이미 보이는 결과 카드는 다시 그리지 않는다(지금처럼 다음 결과부터 반영).
- 가게 목록 다시 받기는 **이번 범위에 넣지 않는다**(시트 수정은 드물고, 보고 있던 결과가 바뀌면 혼란스럽다).
- 판단 로직(건너뛸지·다시 읽을지)은 가능하면 순수 함수로 빼서(`js/rating.js` 등) 단위 테스트한다. 시각은 인자로 받는다.
- 하지 말 것: 연출(`reveal*.js`)·`config.js` 운영 값·`APP_VERSION` 변경, 의존성 추가, **실제 폼 전송**(가짜 폼·가짜 평점 CSV로 확인). 커밋 금지.
- 끝에 `npm run bump`(이제 콘텐츠 해시) 실행.

### DoD
- R-1 단위 테스트: 건너뛰기 조건(꺼짐·돌리는 중·다시보기 중·창 열림) 각각, 평점 다시 읽기 5분 기준(4분 59초 → 안 읽음, 5분 → 읽음).
- R-2 Chrome(가짜 CSV·가짜 폼, 저장소 밖 복사본): 마지막 추천 시각을 31분 전으로 저장해 둔 상태에서 페이지를 연 채로 `visibilitychange`(hidden → visible)를 일으키면 평가 창이 뜸. 30분 전이 안 된 경우 안 뜸. 3일이 지난 기록은 지워짐. 평가 창이 이미 열려 있거나 돌리는 중·공개 연출 중이면 뜨지 않고, 끝난 뒤 다시 보이면 뜸. 확인 방법(시각을 어떻게 조작했는지)을 보고에 적는다.
- R-3 Chrome: 평점 CSV 요청 횟수 — 처음 1회, 5분 안에 다시 보이면 0회 추가, 5분 지난 뒤 다시 보이면 1회 추가.
- R-4 기존 흐름 회귀 없음: 처음 열 때의 평가 창, 돌리기·연출·제외·지도.
- R-5 `npm test` 전부 PASS, `git diff --check` 통과, 버전 테스트 통과(bump 반영).

- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 026 구현 1차. 상세: docs/agents/handoffs/026-rating-on-return.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `js/app.js`, `js/rating.js`, `tests/rating.test.js`, `README.md`(테스트 수113만). 버전 문자열만 `index.html`·`js/animation.js`·`js/data.js`·`js/select.js`·`js/reveal.js` 및 app.js import 갱신. 기록: 이 인계 파일·`docs/agents/worklog.md`. 025 미커밋 변경 유지, 운영 config·APP_VERSION v2.3·연출 로직·CSS·의존성 변경 없음.
- 구현: 초기 진입과 복귀가 같은 initRatings 경로를 사용. visibilitychange는 visible일 때만, pageshow는 persisted=true일 때만 재확인. shouldCheckRatings로 ratingsOn=false·spinning·replaying·평가/제외/공개 dialog open 중 하나라도 해당하면 전체 확인을 건너뜀. 대기 작업을 자동 실행하지 않고 다음 복귀 이벤트에서 다시 확인.
- 평점: refreshRatings가 마지막 **성공 시각**부터5분이 지났을 때만 읽고 진행 중 요청은 공유. 성공하면 state.ratings와 성공 시각만 교체하고 보이는 카드/다시보기 자료는 다시 만들지 않음. 실패하면 console.warn만 남기고 기존 Map·성공 시각을 유지해 다음 복귀에서 재시도 가능. 가게 목록 load/storeCache는 수정하지 않음. 평가 기록은 기존 parsePick→pickStatus의 drop/ask 흐름 그대로 사용.

### DoD 자가 체크

- [x] R-1: 테스트2개 추가. enabled=false / spinning=true / replaying=true / dialogOpen=true 각각 false 및 유휴 상태 true. 최초 읽기·경과0·4분59초·299999ms·정확히300000ms·그 이후 경계 검증. RATINGS_REFRESH_MS=300000 확인.
- [x] R-2: Chrome에서29분 전 추천은 복귀 후 안 뜨고31분 전 추천은 평가 창이 뜸. 달력3일 허용 범위를 넘긴4일 전 기록은 삭제. hidden 단독 이벤트 및 persisted=false pageshow는 무시, persisted=true에서는 평가 창 표시. 이미 평가 중일 때 별4점 선택과 모달 DOM 유지·추가 요청0. 제외 창/카드 안 룰렛/공개 창/다시보기 중 각각 모달 표시0·추가 평점 요청0, 닫고 다시 visible로 돌아오면 평가 창 표시 확인.
  - 시각/이벤트 재현: 저장소 밖 새 프로필의 페이지에서만 Date.now를 `new Date(2026,10,5,12).getTime()` 기준 qaNow로 고정. localStorage의 추천 at을 qaNow−29분/31분/4일로 저장. document.visibilityState를 테스트용 getter로 hidden/visible 전환하며 visibilitychange를 발생시키고, pageshow는 PageTransitionEvent의 persisted=false/true로 분기 확인(자동화 이벤트 주입이며 실제 폰 탭 전환을 기다린 검증은 아님).
  - 돌리기는 완료 시 새 추천 시각을 저장하는 기존 규칙이 있으므로, 돌리기 후 유휴 복귀 검사는 완료된 기록을 다시31분 전으로 맞춰 검증. 다시보기는 기록을 덮어쓰지 않아 같은31분 전 기록 그대로 닫은 뒤 복귀 시 뜨는 것도 확인.
- [x] R-3: 최초 평점 요청1회 → qaNow+299000ms(hidden→visible) 후 누적1회 → +1000ms로 정확히5분 경과 후 누적2회 확인. 이때 카드 outerHTML은 그대로이고 다음 추첨에서만 새 평점(에메랄드→다이아) 반영. 5분 뒤 visibilitychange와 persisted pageshow를 겹쳐 보내고 요청을 CDP에서 보류해도 요청1개만 진행됨. 의도적으로503 응답을 준 경우 경고1회·기존 다이아 값 유지, 다음 복귀 성공 후 다음 추첨에 루비 반영 확인. 마지막 성공 시각 기준 정책 검증.
- [x] R-4: 처음 열 때31분 전 기록이 있는 경우 기존 평가 창 정상. 초기/복귀에서 ratingsOn=false면 CSV/모달 둘 다0. 일반 돌리기·상위 연출·다시보기·제외하기 정상, 실제 SDK 지도 핀3개 확인. 같은 페이지에서 평점 갱신/모달 재확인 전체를 진행하는 동안 가게 CSV는 최초1회로 유지. 마지막의 꺼짐/초기 진입 회귀는 별도 페이지 로드2회라, 전체 자동화 합계는 가게 CSV3회이며 복귀에 따른 추가 목록 요청은0.
- [x] R-5: 최종 `npm run bump` → **419ee43b2143**, 재실행 변경0. `npm test` **113 pass / 0 fail**, 버전 테스트·`git diff --check` 통과. 운영 config·reveal*.js·animation.js·data.js·select.js·package.json·CSS는 버전 문자열 제거 후 HEAD와 동일함을 확인. 폼 POST 시도/요청0·런타임 예외0. 생성한 테스트 서버/Chrome 종료, 커밋·푸시·배포 없음.

### 재현 자료

- 프로젝트 루트에서 `node C:/Users/root/AppData/Local/Temp/lunch026-prepare.mjs`로 복사본을 만들고, 그 폴더에서 `npx --yes serve -l 5173 .` 실행 후 `node .../lunch026-browser.mjs`로 검증. 이번 복사본은 `C:/Users/root/AppData/Local/Temp/lunch026-browser-cwsYyr`이며 가짜 CSV/가짜 폼/평점 주소는 이 안에서만 수정. 정상 JavaScript 키로 실제 SDK 지도 핀 회귀 확인, 실제 폼 URL은 CDP 차단과 POST fetch 차단을 함께 적용.
- `TEMP/lunch026-check/return-rating.png`·`result.json` 보관. 결과 JSON의 경고1회는 의도한 가짜503 응답에 대한 것. 초기/5분 경계 뒤에도 여러 복귀·실패/재시도·초기 로드 회귀를 추가해 전체 평점 요청은10회이며, R-3 기본 횟수는 위1→1→2 구간으로 검증.
- `lunch026-scope.py`에서 운영 설정/연출 등 보호 파일의 버전 표기 외 차이 없음을 확인.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (DoD 5/5)
- `npm test` 113 pass / 0 fail, `git diff --check` 통과, bump 재실행 시 변경 0(`419ee43b2143`).
- 코드 검토: `shouldCheckRatings`·`shouldRefreshRatings`(`js/rating.js`)가 순수 함수로 분리돼 테스트됨. `app.js`는 `visibilitychange`(visible)·`pageshow`(persisted)에서 `initRatings` 재사용, 세 dialog open·spinning·replaying이면 건너뜀. 평점은 마지막 성공 시각 기준 5분, 진행 중 요청 공유, 실패 시 기존 값 유지. 가게 목록 재요청 없음(지시대로).
- R-2·R-3은 코덱스의 Chrome 이벤트 주입 검증. 실제 휴대폰 탭 전환은 배포 후 사용자가 같은 방법으로 다시 확인할 것.
- 실기기 확인(2026-11-06 사용자, 배포본 `c51cbc3`): 30분 지나 탭으로 돌아오자 평가 창 정상 표시. H-5 종료.
