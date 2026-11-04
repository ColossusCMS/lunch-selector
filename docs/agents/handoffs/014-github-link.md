# 014 화면 하단 GitHub 소개 링크

## 지시 (PM)
- 배경(2026-11-04 사용자 요청, 버전·릴리스와 별개): 화면 맨 아래 `✏️ 가게 목록 편집하기` 링크 **아래**에 GitHub 저장소 소개 페이지로 가는 링크를 하나 더 둔다.
- 변경:
  - 링크: `https://github.com/ColossusCMS/lunch-selector`, 문구 `🐙 GitHub에서 소개 보기`, `target="_blank" rel="noopener"`.
  - 주소는 `js/config.js`에 `export const ABOUT_URL = '...'`로 두고(빈 값이면 링크 숨김), 앱 시작 시 `href`를 채운다. `index.html`에는 링크 요소를 `hidden`으로 두고 값이 있으면 표시(스크립트 실패 시 빈 링크가 보이지 않게). 다른 config 값 변경 금지.
  - 스타일: 편집 링크와 같은 톤, 같은 가운데 정렬. 두 링크가 세로로 쌓이고 적당한 간격(약 6~8px). 편집 링크가 숨겨지는 경우(시트 ID 없음)에도 GitHub 링크는 단독으로 자연스럽게 보일 것.
  - 모드 전환·로딩 실패·빈 시트 등 어떤 상태에서도 GitHub 링크는 그대로 보인다.
- 범위: `index.html`, `js/config.js`, `js/app.js`, `css/style.css`, 필요 시 테스트, `npm run bump`. 실제 폼 전송 금지.
- DoD:
  - G-1 하단에 편집 링크 → GitHub 링크 순서, 주소·새 탭·rel 정확 — headless Chrome.
  - G-2 `ABOUT_URL=''`이면 숨김, 편집 링크 숨김 상태에서도 GitHub 링크 단독 표시 정상(복사본).
  - G-3 360·400 × 라이트·다크 스크린샷 `docs/agents/screenshots/014/`.
  - G-4 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과.
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 014 구현 1차. 상세: docs/agents/handoffs/014-github-link.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `index.html`(hidden 소개 링크), `js/config.js`(ABOUT_URL 상수만 추가), `js/app.js`(시작 시 소개 링크 href/hidden 초기화), `css/style.css`(푸터 링크 세로 정렬·간격). 버전만 `js/data.js`·`js/select.js` 및 app.js import. 기록: 이 인계 파일·`docs/agents/worklog.md`; screenshots/014 캡처4개. 시작 시 기존 worklog 변경 유지.
- 구현: 편집 링크 바로 아래 `🐙 GitHub에서 소개 보기`, `target=_blank`·`rel=noopener`. ABOUT_URL.trim()이 비면 hidden 유지, 있으면 href 설정·노출. 데이터 로딩과 독립적으로 초기화해 모드·오류·빈 시트 상태에도 유지. 두 링크는 block/fit-content/가운데 정렬, 편집 링크가 보일 때만 소개 링크 위8px 간격.
- 자체 검증: `npm run bump` → `202611041112`; `npm test` **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과. 다른 config 값 변경·실제 폼 전송·커밋·배포 없음.
- DoD 자가 체크:
  - [x] G-1: Chrome 링크 문구·주소 https://github.com/ColossusCMS/lunch-selector ·target/rel 확인. 편집→소개 순서, 간격8px. 두 링크 중심x는 360px에서180px, 400px에서200px(편집 링크 소수점 오차<0.01px).
  - [x] G-2: 저장소 밖 복사본에서 ABOUT_URL=''면 hidden=true·href 없음. SHEET_ID=''면 편집 링크만 hidden, 소개 링크 표시·margin-top0px로 단독 표시 정상. 모드 전환·가게 목록 로딩 실패·빈 시트에서도 소개 링크 유지 확인.
  - [x] G-3: `docs/agents/screenshots/014/footer-360-light.png`, `footer-360-dark.png`, `footer-400-light.png`, `footer-400-dark.png` 저장 및 직접 확인.
  - [x] G-4: 전체83개 테스트·버전 일관성 통과. Chrome 런타임 예외 없음.
- 재현: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch014-verify.mjs`(프로젝트 루트에서 node), 가짜 CSV/폼 설정 복사본 `lunch014-check` 사용. 실제 폼 호출 없음.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **반려(간격 1건, 사용자 요청)** — 그 밖의 G-1~G-4는 통과 확인(`footer-360-light.png` 직접 확인, 링크 주소·문구는 사용자 확정).
- 이슈 R-1: 작은 화면에서 잘못 누르지 않도록 두 링크 사이를 넓힌다.
  - 두 링크 모두 누르는 영역을 키운다: `display:block`(또는 inline-block) + 상하 패딩 약 10px·좌우 12px → 각 링크 터치 영역 높이 **40px 이상**.
  - 두 링크 박스 사이 간격 **12px 이상**(글자 기준으로는 약 30px 이상 떨어져 보이게). 편집 링크가 숨겨질 때 위 간격 0 유지.
  - 터치 영역이 겹치지 않음을 좌표로 확인(편집 링크 bottom < 소개 링크 top - 12).
  - 360·400 × 라이트·다크 캡처를 `screenshots/014/v2-` 접두로 저장, `npm run bump`, `npm test`.
- 끝나면 "구현 보고 2차" 절을 추가하고 `[codex→pm] 완료 014 구현 2차`를 보낸다.

## 구현 보고 2차 (코덱스)

- 이번 회차 변경 파일: `css/style.css`(두 링크 min-height40px·padding10px 12px, 링크 간격16px). 버전만 `index.html`, `js/app.js`, `js/data.js`, `js/select.js`. 기록: 이 인계 파일·`docs/agents/worklog.md`. `screenshots/014/v2-` 캡처4개 추가, 1차 캡처 보존.
- R-1 수정·좌표 검증: 360/400px × 라이트/다크 모두 편집·소개 링크 높이 **각40px**, 편집 bottom572px / 소개 top588px로 **박스 간격16px**. `572 < 588 - 12` 충족하여 터치 영역 겹침 없음. 링크 가운데 정렬 유지. 편집 링크 hidden 상태에서는 소개 margin-top0 유지.
- 회귀: 주소·새 탭·noopener·빈 ABOUT_URL 숨김·편집 없이 단독 표시·모드 전환·로딩 실패·빈 시트 모두 Chrome PASS, 런타임 예외 없음. `npm run bump` → `202611041113`; `npm test` **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과.
- 캡처: `v2-footer-360-light.png`, `v2-footer-360-dark.png`, `v2-footer-400-light.png`, `v2-footer-400-dark.png`를 `docs/agents/screenshots/014/`에 저장 및 직접 확인. 재현 스크립트 `C:/Users/root/AppData/Local/Temp/lunch014-v2-verify.mjs`(프로젝트 루트에서 node), 가짜 설정 복사본은 저장소 밖.
- 설계와 다르게 한 점 / 질문: 없음. 실제 폼 전송·커밋·배포 없음.

## PM 검증 2차 (클로드)
- 결과: **통과** (G-1~G-4, R-1 해소)
- 확인: `npm test` 83 pass, `config.js`는 `ABOUT_URL` 추가만, 변경 파일 범위 내. `v2-footer-360-light.png` 직접 확인 — 두 링크 터치 영역 각 40px, 박스 간격 16px(글자 간격 약 55px), 가운데 정렬.
