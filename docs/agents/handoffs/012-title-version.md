# 012 제목 옆 앱 버전 표시 (v2.1)

## 지시 (PM)
- 배경(2026-11-04 사용자 요청): 화면 제목 옆에 앱 버전을 붙인다. 예: `🍱 오늘 점심 뭐 먹지? v2.1`. 이번 커밋에 `v2.1` 태그·릴리스를 만든다.
- 변경:
  - `js/config.js`에 `export const APP_VERSION = 'v2.1';` 추가(릴리스 때 여기만 고치면 되도록 주석 한 줄). 다른 config 값 변경 금지.
  - 제목(`h1#heading`): 모드 heading 텍스트 뒤에 작은 버전 표시 요소(예: `<span class="app-version">v2.1</span>`)를 붙인다. `selectMode`에서 `textContent`로 heading을 바꾸는 부분이 버전 요소를 지우지 않게 처리(제목 텍스트용 span을 따로 두거나 `replaceChildren`). `innerHTML` 금지.
  - 스타일: 제목보다 작고(약 0.5~0.6em) 연한 색, 제목 글자 기준선에 맞춤. 라이트·다크 모두 읽힐 것. 360px에서 제목+버전이 한 줄에 들어가는지 확인(안 들어가면 보고).
  - `index.html`의 초기 `h1` 마크업도 같은 구조로(스크립트 실행 전에도 깨지지 않게). `document.title`(브라우저 탭 제목)에는 버전을 넣지 않는다.
  - `APP_VERSION`이 빈 값이면 버전 요소를 숨긴다.
- 범위: `js/config.js`, `js/app.js`, `index.html`, `css/style.css`, `tests/*`(필요 시), `README.md`·`docs/SETUP.md`에 "릴리스 때 `APP_VERSION` 갱신" 한 줄, 버전 bump. 실제 폼 전송 금지.
- DoD:
  - V-1 점심·카페 모드 전환 후에도 제목 옆 `v2.1` 유지, 탭 제목에는 버전 없음 — headless Chrome.
  - V-2 `APP_VERSION = ''`이면 버전 요소 숨김(복사본에서 확인).
  - V-3 360·400px 라이트·다크에서 한 줄·대비 확인, 스크린샷 `docs/agents/screenshots/012/`.
  - V-4 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과.
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 012 구현 1차. 상세: docs/agents/handoffs/012-title-version.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다(PM이 사용자 요청으로 커밋·태그한다).

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `js/config.js`(APP_VERSION 상수·주석만 추가), `js/app.js`(상수 import·제목 텍스트 요소 분리·버전 초기화), `index.html`(초기 제목 구조), `css/style.css`(작은 버전 표시), `README.md`·`docs/SETUP.md`(릴리스 갱신 안내 한 줄). 버전만 `js/data.js`·`js/select.js` 및 app.js import. 기록: 이 인계 파일·`docs/agents/worklog.md`, screenshots/012 캡처8개. 이전 010·011 미커밋 변경 유지.
- 구현: `h1#heading` 안의 heading-text span만 모드 전환 시 갱신. app-version span은 APP_VERSION으로 초기화하고 trim 결과가 비면 hidden. 초기 HTML에도 같은 두 span과 v2.1 표시. 버전은 제목의 .55em(13.2px), 중립 보조색·기준선 정렬. document.title 생성 방식 유지.
- 자체 검증: `npm run bump` → `202611041049`; `npm test` **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과. 기존 config 값 추가 변경·실제 폼 전송·커밋·태그·릴리스·배포 없음.
- DoD 자가 체크:
  - [x] V-1: Chrome 점심↔카페 전환에서 v2.1 유지·탭 제목에 버전 없음 확인.
  - [x] V-2: 저장소 밖 복사본 APP_VERSION=''로 바꾸고 재접속, 버전 textContent=''·hidden=true 확인.
  - [x] V-3: 360/400px × 라이트/다크 × 점심/카페 캡처8개 `docs/agents/screenshots/012/{lunch,cafe}-{360,400}-{light,dark}.png` 저장. 제목 높이32px로 한 줄 유지. 360px 카페(더 긴 제목)에서도 버전 오른쪽330.94px < 내용 오른쪽344px. 색은 라이트 rgb112/103/95, 다크182/175/170. 캡처 직접 확인.
  - [x] V-4: 전체83개 테스트·버전 일관성 통과, Chrome 런타임 예외 없음.
- 재현: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch012-verify.mjs`(프로젝트 루트에서 node), 가짜CSV·폼 설정 복사본 `lunch012-check` 사용.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (V-1~V-4)
- 확인: `npm test` 83 pass, `config.js`는 `APP_VERSION` 추가만(010의 like 제거 외 다른 값 유지), `index.html` 초기 제목 두 span 구조. `cafe-360-light.png` 직접 확인 — 가장 긴 제목에서도 한 줄, 버전 작고 연하게 기준선 정렬.
- 사용자 요청으로 PM이 010~012를 커밋하고 로컬 `v2.1` 태그를 만든다(푸시는 사용자).
