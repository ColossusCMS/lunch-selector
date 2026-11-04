# 010 좋아요 제거 + 평가 줄 "이름 왼쪽 · 별 오른쪽" 배치

## 지시 (PM)
- 배경(2026-11-04 사용자 결정):
  - 좋아요는 카드 표시 외 활용처가 없고, 실제 응답 6건 중 좋아요만 누른 건 0건(모두 별점 동반) → **화면·전송·집계에서 제거**. 구글 폼의 `좋아요` 질문과 응답 시트의 기존 값은 **그대로 둔다**(코드만 안 씀).
  - 평가 모달 배치: 다른 서비스 조사 후 "여러 대상 평가 = 한 줄에 이름 왼쪽, 별 오른쪽"(요기요 맛·양·배달 행 방식)으로 결정. 009의 👍 가게명 줄 / 별 양끝 맞춤 / 문구 가운데 배치를 대체.
- 기준점: `HEAD` = `f196485`(006~009 커밋됨).

### A. 좋아요 제거
- `js/app.js`: 👍 버튼·`choice.like`·좋아요 효과 제거. `보내기`는 **별점을 고른 가게가 하나 이상일 때만** 활성. 전송 대상도 별점 있는 가게만.
- `js/rating.js`: `buildRatingBody`에서 like 항목 제거(폼에 좋아요 값 안 보냄). `aggregateRatings`는 `좋아요` 열을 읽지 않고 `RatingStat`에서 `likes` 제거. `formatStatLine`: 평가 부족이면 기존 문구(`아직 평가가 부족해요` / 작은 카드 `평가 부족`), 그 외 `★4.2`만(aria-label `평균 별점 4.2점`).
- `js/config.js`: `RATING.entries.like` 키 삭제, `ratingEnabled` 필수 키에서 `like` 제거. 다른 값 변경 금지.
- `css/style.css`: `.rating-like*`, `like-pop` 관련 규칙 제거.
- 문서: `docs/SETUP.md` 폼 질문 안내를 `모드·지역·가게명·별점` 4개로(기존 폼의 `좋아요` 질문은 남아 있어도 무방하다는 한 줄), `README.md`의 좋아요·👍 언급 정리.

### B. 평가 줄 배치
```
짱김밥                    [★][★][★][★][☆]
                             맛있어요
─────────────────────────────────────────
아주아주긴가게이름과      [☆][☆][☆][☆][☆]
메모가있는식당
```
- 가게 하나 = 한 행. **가게명 왼쪽**(남는 폭 차지, 길면 줄바꿈 — 말줄임 금지), **별 묶음 오른쪽 끝**(줄어들지 않음). 가게명과 별 묶음은 세로 가운데 정렬.
- 점수 문구: 별 묶음 **바로 아래, 별 묶음 기준 가운데**. 문구가 없을 때도 높이 확보(모달 높이 안 흔들림).
- 별 크기: 별 묶음이 오른쪽에 붙으므로 009의 44px보다 작게 — 버튼 약 32~36px 정사각, 별 사이 간격 2~4px. **360px에서 가게명 6글자(예: `금복돈육식당`)가 한 줄에 들어가는 것**을 목표로 크기·간격·모달 폭을 조정. 필요하면 모달 폭을 009 이전 값(`min(440px, calc(100% - 32px))`)으로 되돌려도 된다. 목표를 못 맞추면 측정값과 함께 보고.
- 별 글리프 세로 가운데(≤1px), 금색/회색, 누를 때 `star-pop`, reduce 처리는 유지(새 크기에서 다시 맞춤).
- 가게 사이 구분선·제목 두 줄·하단 버튼 줄(`다음에` 왼쪽 / `안 갔어요`·`보내기` 오른쪽)은 그대로.

### 범위·제약
- 변경: `js/app.js`, `js/rating.js`, `js/config.js`(like 키 삭제·ratingEnabled), `css/style.css`, `tests/*`, `docs/SETUP.md`, `README.md`, 버전 bump. 의존성 금지, 실제 폼 전송 금지, `innerHTML` 금지.
- 계획과 다르게 해야 할 이유가 생기면 보고에 질문으로 남기고 멈춘다.

### DoD
- L-1 좋아요 UI·전송·집계·카드 표시 없음, 카드 평점 줄 `★4.2`/평가 부족 문구 — 단위 테스트 + Chrome.
- L-2 `보내기`: 별점 0곳이면 비활성, 1곳 이상 활성, 가짜 폼 POST에 like entry 없음·별점/지역/모드/가게명 정상.
- L-3 `ratingEnabled`가 like 없이 true(현재 config 기준), like 키 없는 config로 평점 기능 정상 동작.
- L-4 배치: 가게명 왼쪽·별 묶음 오른쪽 끝(좌표 기재), 문구는 별 묶음 아래 가운데, 문구 유무로 높이 불변, 360px에서 `금복돈육식당` 한 줄·긴 이름 줄바꿈 시 별과 안 겹침.
- L-5 별 글리프 세로 가운데 ≤1px(새 크기, 360·400 × 라이트·다크), star-pop·reduce 유지.
- L-6 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과, 문서 갱신 대조.
- L-7 스크린샷 `docs/agents/screenshots/010/`: 360·400 × 라이트·다크, 가게 3곳(4점 선택 / 미평가 / 긴 이름) + 결과 카드 평점 줄 1장.
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 010 구현 1차. 상세: docs/agents/handoffs/010-rating-list-layout.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 기준 확인: 시작 시 HEAD `f196485` 기준 소스 변경 없음(010 인계 파일만 untracked). 이번 변경 파일: `js/app.js`, `js/rating.js`, `js/config.js`, `css/style.css`, `tests/rating.test.js`, `tests/data.test.js`, `README.md`, `docs/SETUP.md`. 버전만 `index.html`, `js/data.js`, `js/select.js` 및 app.js import. 협업 기록: 이 인계 파일·`docs/agents/worklog.md`, 캡처5개 `screenshots/010/`.
- 구현: 좋아요 UI·choice.like·효과·전송 대상 조건·POST entry·집계 필드·카드 표시 모두 제거. config는 like 키와 필수 검사만 제거하고 나머지 값 보존. 기존 폼/응답 시트는 변경하지 않음. 이름 왼쪽·34px 별5개 오른쪽(간격3px), 문구는 별 아래 가운데 고정 높이. 모달 폭은 허용된 `min(440px, calc(100% - 32px))`로 복원. 이름 아래에 문구 높이에 해당하는 여백을 두어 이름 중심과 별 버튼 줄 중심을 정렬. 제목·하단 버튼 배치 유지.
- 자체 검증: `npm run bump` → `202611041025`; `npm test` → **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과. 의존성 추가·실제 폼 전송·커밋·배포 없음.
- DoD 자가 체크:
  - [x] L-1: 기존 좋아요 열이 들어 있는 CSV fixture에서도 집계 결과는 avg/count만. 카드 formatStatLine은 `★4.2`·aria `평균 별점 4.2점` 또는 기존 평가 부족 문구. js/css/README에서 좋아요 참조 없음, SETUP에는 기존 폼 보존 안내만 남김. Chrome 결과 카드에도 별점/평가 부족만 표시 확인.
  - [x] L-2: Chrome 별점0개 시 보내기 비활성, 선택 시 활성, 재클릭 해제 후 비활성. 가짜 폼에는 선택한 첫 가게 하나만 POST, mode=lunch·region=검암·name=금복돈육식당·stars=4 및 정확히4개 entry만 확인. 옛 like entry를 명시적으로 넘겨도 body에서 제외하는 단위 테스트 추가.
  - [x] L-3: like 없는 fixture의 ratingEnabled=true 단위 검증, 현재 실제 config도 ratingEnabled=true·like 키 없음 별도 Node 검증. 가짜 폼을 쓰는 Chrome에서도 like 설정 없이 집계·모달·전송 정상.
  - [x] L-4: 360px 이름 x=31~137(폭106px), 별 묶음 x=147~329(폭182px), 내용 오른쪽329px와 일치. `금복돈육식당` 높이21px=한 줄. 이름 중심y318.81px=별 줄 중심y318.81px. 400px 이름 폭146px, 별 묶음 x=187~369로 내용 오른쪽369px와 일치. 문구 중심은 별 기준 x238px(360)/278px(400), 별 아래4px. 1~5점·해제 모두 모달 높이 불변. 긴 이름은 360에서4줄/400에서3줄, 별과10px 간격 유지.
  - [x] L-5: 새34×34px·글리프1.25rem·-2px 보정. 캡처 정수 픽셀 경계 기준 첫 줄★4개·☆1개 분석: 360/400 라이트★위/아래10/9px·☆9/9px, 다크★9/9px·☆9/8px, 최대차이1px. 기존과 같은 글리프색 RGB 오차≤70 마스크 사용. star-pop 실행·연속 클릭 재시작·reduce에서 애니메이션 없음 Chrome 확인.
  - [x] L-6: 전체83개 테스트·버전 일관성 통과. SETUP 네 질문·entry4개·별점 선택 가게만 전송·기존 좋아요 질문/응답 보존 안내, README 좋아요 언급 제거 및 테스트 수 갱신.
  - [x] L-7: `rating-360-light.png`, `rating-360-dark.png`, `rating-400-light.png`, `rating-400-dark.png`, `result-rating.png`를 `docs/agents/screenshots/010/`에 저장. 모달 첫 가게4점·둘째미평가·셋째긴이름, 결과 카드 별점★4.2 및 평가 부족 포함. 캡처 직접 확인.
- 재현: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch010-verify.mjs`(프로젝트 루트에서 node), `lunch010-pixels.py`(python). 복사본/가짜CSV·폼 서버 `lunch010-check`, DOM 측정값 `lunch010-check/metrics.json`. 런타임 예외 없음.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (L-1~L-7), 사용자가 스크린샷 확인 후 승인
- 확인: `npm test` 83 pass, `git status` 범위 내, `config.js`는 `like` 키·필수 검사 제거만(다른 entry 값 유지), `js/`·`css/`에 좋아요 참조 없음. `rating-360-light.png` 직접 확인 — 이름 왼쪽·별 묶음 오른쪽 끝, 문구 별 아래 가운데, `금복돈육식당` 한 줄, 긴 이름 줄바꿈·겹침 없음, 제목 두 줄·하단 버튼 유지.
