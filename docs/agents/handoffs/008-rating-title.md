# 008 평가 모달 제목 두 줄

## 지시 (PM)
- 배경(2026-11-03 사용자 피드백): 모달 제목 `🍽️ 11/3 점심 추천, 다녀온 곳이 있으면 평가해 주세요`가 한 줄로 이어지다 아무 데서나 줄바꿈돼 불균형하다. 모달 디자인 세부 다듬기의 첫 항목.
- 변경:
  - 제목을 의미 단위로 두 줄로 나눈다.
    - 1줄: `🍽️ 11/3 점심 추천` (날짜·모드 라벨 생성 방식은 기존 그대로, 쉼표 제거)
    - 2줄: `다녀온 곳이 있으면 평가해 주세요`
  - 두 줄 모두 기존 `h2#rating-title` 안에 둔다(예: 각 줄을 `display:block` span으로, `textContent`만). `aria-labelledby`로 읽히는 이름에 두 줄이 모두 포함되어야 한다.
  - 글자 크기·굵기 등 스타일은 지금 제목과 같게 둔다(사용자가 줄 구분만 요청). 1줄이 닫기 버튼(✕)과 겹치지 않게 기존 여백 유지.
- 범위: `js/app.js`(`showRatingCard` 제목 부분), 필요 시 `css/style.css`, 버전 bump. 그 밖의 변경 금지. 실제 폼 전송 금지.
- DoD:
  - T-1 360px·400px 라이트/다크에서 제목이 정확히 두 줄(각 줄 안에서 추가 줄바꿈 없음), ✕와 겹치지 않음 — headless Chrome 스크린샷. 360px에서 2줄이 넘치면 임의로 바꾸지 말고 보고에 질문.
  - T-2 카페 모드 기록이면 `☕` 라벨 대신 `🍽️ 11/3 카페 추천`처럼 기존 규칙대로 나옴 — Chrome.
  - T-3 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과.
  - T-4 스크린샷은 `docs/agents/screenshots/008/`에 저장(프로젝트 AGENTS.md 규칙).
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 008 구현 1차. 상세: docs/agents/handoffs/008-rating-title.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

### 추가 지시 (PM, 사용자 요청)
- 1줄 맨 앞 아이콘을 고정 `🍽️` 대신 **그 모드 라벨의 앞 이모지**로 쓴다: 점심 `🍱 11/3 점심 추천`, 카페 `☕ 11/3 카페 추천`. `MODES[].label`(`'🍱 점심'`, `'☕ 카페'`)의 첫 공백 앞 부분을 쓰고, 모드 이름은 지금처럼 나머지 부분. 라벨에 이모지가 없으면(공백 없음 등) `🍽️`로 대체.
- 가능하면 라벨 → `{ icon, name }` 분리를 순수 함수로 두고 테스트 추가.
- T-2를 이 기준으로 확인: 카페 기록 → `☕ 11/3 카페 추천`.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `js/app.js`(제목 생성·helper import), `css/style.css`(제목 span block), 추가 지시에 따른 `js/rating.js`(ratingModeLabel), `tests/rating.test.js`(라벨 분리 테스트). 버전만 변경: `index.html`, `js/data.js`, `js/select.js` 및 app.js import. 기록: 이 인계 파일·`docs/agents/worklog.md`. 스크린샷 5개: `docs/agents/screenshots/008/`.
- 구현: h2#rating-title 안에 textContent로 채운 span 두 개를 배치. 첫 줄은 모드 이모지·날짜·이름·추천, 둘째 줄은 안내 문구. 두 span 사이 공백 텍스트로 접근성 이름에서도 문장이 이어지도록 유지. 제목 크기·굵기·여백·모달 크기 변경 없음. 순수 함수 ratingModeLabel은 라벨 첫 부분의 이모지를 분리하고, 공백이나 이모지가 없으면 🍽️로 대체하며 이름은 보존.
- 자체 검증: `npm test` → **83 pass / 0 fail**; `npm run bump` → `202611031911`; 버전 일관성 및 `git diff --check` 통과. 설정값 변경·실제 폼 전송·커밋·배포 없음.
- 화면 검증: 저장소 밖 복사본·가짜 CSV/폼 설정과 Chrome headless 사용. 재현 스크립트 `C:/Users/root/AppData/Local/Temp/lunch008-verify.mjs`(프로젝트 루트에서 node로 실행).
- DoD 자가 체크:
  - [x] T-1: 360px/400px × 라이트/다크 모두 각 span 높이 25.59px = 한 줄(line-height 25.6px), 총 두 줄. 첫 줄 텍스트 오른쪽 168.69px, 닫기 버튼 왼쪽은 360px에서 301.92px로 겹침 없음. 캡처와 DOM 확인.
  - [x] T-2(추가 지시 기준): 점심은 `🍱 11/3 점심 추천`, 카페 기록은 `☕ 11/3 카페 추천`. Chrome 확인 및 이모지 없는 라벨 대체 단위 테스트 통과.
  - [x] T-3: 전체 83개 테스트·버전 일관성 통과, 런타임 예외 없음.
  - [x] T-4: `lunch-360-light.png`, `lunch-360-dark.png`, `lunch-400-light.png`, `lunch-400-dark.png`, `cafe-400-dark.png`를 `docs/agents/screenshots/008/`에 저장. 캡처 직접 확인.
- 설계와 다르게 한 점 / 질문: 없음. 006·007의 기존 미커밋 변경을 유지함.

## PM 검증 1차 (클로드)
- 결과: **통과** (T-1~T-4, 추가 지시 포함)
- 확인: `npm test` 83 pass, `config.js` 연결값 유지, diff 검토(`ratingModeLabel` 순수 함수·테스트, 제목 span 2개 `textContent`). `docs/agents/screenshots/008/` 캡처 확인 — 360px 라이트에서 정확히 두 줄·✕ 겹침 없음, 카페 기록은 `☕ 11/3 카페 추천`.
