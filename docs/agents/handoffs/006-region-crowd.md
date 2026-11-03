# 006 지역·혼잡도 (사용여부 삭제, 평점 키에 지역)

## 지시 (PM)
- 계획(설계 포함): `docs/superpowers/plans/2026-11-03-region-crowd.md`
- 이번 범위: Task 1~6 전부
- DoD: R-1~R-11 (화면 항목도 자체 확인. PM이 다시 확인한다)
- 주의:
  - 커밋하지 않는다. 기준점은 현재 `HEAD`(`455d011`).
  - `js/config.js`는 `RATING.entries.region: ''` 키 추가만. 기존 값 변경 금지. 실제 구글 폼 전송 금지. 화면 확인은 저장소 밖 복사본 + 가짜 CSV.
  - 화면 구성(지역 줄 → 그룹 줄 → 업종 줄, 지역 `[전체]` 없음)은 사용자가 정한 것이다. 배지의 상세 시각 디자인만 재량.
  - 계획과 다르게 해야 할 이유가 생기면 임의로 바꾸지 말고 아래 보고에 질문으로 남기고 멈춘다.
  - 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 006 구현 1차. 상세: docs/agents/handoffs/006-region-crowd.md"`를 보내고 턴을 끝낸다.

## 구현 보고 1차 (코덱스)

- 변경 파일: `js/stores.js`, `js/select.js`, `js/rating.js`, `js/app.js`, `js/config.js`, `index.html`, `css/style.css`, `tests/stores.test.js`, `tests/select.test.js`, `tests/rating.test.js`, `tests/data.test.js`, `data/sample-stores.csv`, `docs/SETUP.md`, `README.md`. `js/data.js`는 bump에 따른 import 버전만 변경. 이 인계 보고와 `docs/agents/worklog.md` 기록 추가.
- 구현: 지역 파싱·선택·지역별 그룹 기억·옛 그룹 키 이전, 지역 단위 후보/업종/휴무 분리, 사용여부 무시, 1·2·3순위 혼잡도 배지, 지역 포함 평점 키/추천 기록/폼 본문 반영. 그룹 빈 가게는 지역 전체에 포함.
- 자체 검증: `npm run bump` 1회 → `202611031842`, `npm test` → **80 pass / 0 fail**, `git diff --check` 통과.
- 화면 검증: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch006-check`에 복사본·가짜 CSV·가짜 폼 수신 서버 구성. Chrome headless/CDP로 검증. 실행 스크립트 `C:/Users/root/AppData/Local/Temp/lunch006-verify.mjs` (`node <스크립트 경로>`, 프로젝트 루트에서 실행). 라이트·다크 360px 캡처 `lunch006-check/light.png`, `dark.png` 직접 확인: 긴 가게명 포함 배지·메타·별점·링크 겹침 없음.
- DoD 자가 체크:
  - [x] R-1: 지역/혼잡도 trim·전각/반각 쉼표·빈 지역 제외·알 수 없는 혼잡도·지역 열 없음/전체 빈칸·사용여부 무시 단위 검증.
  - [x] R-2: 같은 그룹명을 가진 다른 지역 후보/업종/휴무 미혼합, 그룹 없는 가게 포함 단위 검증.
  - [x] R-3: 지역별 평점 분리, 지역 없는 CSV, 지역 전송 본문, 옛 기록 무효, region entry 누락 시 꺼짐 단위 검증.
  - [x] R-4: 첫 방문 지역만 표시·안내·돌리기 비활성, 지역 선택 후 그룹/업종 표시, 그룹 없는 지역의 그룹 줄 숨김 Chrome 확인.
  - [x] R-5: 지역 열 없는 CSV와 지역 단일 CSV 모두 자동 선택·지역 줄 숨김 Chrome 확인.
  - [x] R-6: 검암→을지로→검암 그룹 복원, 새로고침 지역 복원, 없는 그룹은 전체, 다른 모드에 지역 없을 때 저장값 유지, 단일 지역 자동 선택 시 저장값 보존, 깨진 groups JSON, 옛 키 이전 성공/실패 후 삭제, storage 읽기/쓰기/삭제 실패에도 동작 Chrome 확인.
  - [x] R-7: 세 카드 혼잡도 3종, 빈칸/오타 미표시, 일반 릴 회전 중 카드 숨김, 360px 라이트·다크 캡처 확인.
  - [x] R-8: 가짜 평점에서 같은집이 검암은 다이아(5), 을지로는 원석(2). 이전 추천 모달의 지역(을지로)이 가짜 POST 본문 entry.region에 포함됨 확인. 실제 폼 전송 없음.
  - [x] R-9: 전체 단위 테스트 통과. Chrome 모드 전환·업종 필터·휴무 줄·결과 초기화·일반/움직임 줄이기 카드 공개·평가 모달·테마·지도 비활성 대체 동작 확인. 지도 좌표/링크 로직은 기존 단위 테스트 통과. 실제 카카오 SDK/핀은 이번 가짜 환경에서 호출하지 않음(지도 소스 변경 없음).
  - [x] R-10: SETUP 시트 표·폼 5개 질문·배포 전 1→2→3 절차와 샘플 3지역 갱신. 버전 일관성 테스트 통과.
  - [x] R-11: 의존성 추가·커밋·배포 없음. 기존 config 설정값 모두 유지. `RATING.entries.region: ''` 추가와 Task 3에 명시된 `ratingEnabled` 필수 키 검사에 region 추가만 수행.
- 설계와 다르게 한 점 / 질문: 없음. 실사용 region entry는 빈 값이므로 사용자 설정 전 평점 기능은 꺼지는 것이 정상. 배포 전 사용자 작업은 SETUP의 마지막 절에 정리.

## PM 검증 1차 (클로드)
- 결과: **반려(경미 2건)** — 나머지 R-1~R-11은 통과 확인
- 확인한 것: `npm test` 80 pass, `git status` 범위 내, `config.js`는 `region: ''` 추가 + `ratingEnabled` 키 추가만. diff 검토(stores/select/rating/app). 코덱스 검증 스크립트 재실행 전 항목 PASS, 별도 가짜 시트(검암 3층·4층/을지로 9층·10층/판교 그룹 없음)로 ①②③·결과 카드·다크 스크린샷 직접 확인 — 배지·레이아웃 문제 없음.
- 이슈:
  - **R-1** `js/app.js` `load()` 빈 시트 분기 · 기대: 기존처럼 `시트에 가게가 없어요` + `els.retry.hidden = false`(사이클 001에서 빈 시트를 캐시하지 않고 다시 시도할 수 있게 한 동작) · 실제: `els.retry.hidden = false` 줄이 빠져 다시 시도 버튼이 안 뜸. 줄 복원.
  - **R-2** `js/stores.js` 지역 파싱 · 기대: 지역 칸 `,을지로`처럼 첫 값이 빈 경우 이름 없는 지역 칩(빈 라벨)이 생기지 않아야 함 · 실제: `region.split(/[,，]/)[0]`이 `''`가 되어 지역 열을 쓰는 시트에 `''` 지역이 섞임. `splitMulti(region)[0] ?? ''`(빈 값 제거 후 첫 값)로 바꾸고, 결과가 빈 값이면 빈 지역 행과 같이 경고 후 제외. 테스트 1개 추가.
- 수정 후 `npm run bump` 다시 실행(버전 일관성 유지).

## 구현 보고 2차 (코덱스)

- 이번 회차 변경 파일: `js/app.js`, `js/stores.js`, `tests/stores.test.js`, `README.md`, `index.html`, `js/data.js`, `js/select.js`, 이 인계 파일, `docs/agents/worklog.md`. `index.html`·`js/data.js`·`js/select.js`는 버전 변경만, README는 테스트 수 갱신.
- R-1 수정: 빈 시트 분기에 `els.retry.hidden = false` 복원. Chrome 가짜 빈 CSV에서 버튼 노출을 확인하고, 같은 CSV 파일에 가게를 추가한 뒤 다시 시도로 재조회·추천 가능 상태 복귀 확인(빈 결과 미캐시).
- R-2 수정: `splitMulti(region)[0] ?? ''`로 빈 조각 제거 후 첫 유효 지역을 사용. 지역을 쓰는 시트에서 쉼표뿐이라 결과가 빈 행은 경고 후 제외. 반각·전각 선행 쉼표, 쉼표만 있는 행, 쉼표만 있는 전체 시트 회귀 테스트 추가. Chrome에서 `， 을지로`·`검암`·쉼표뿐인 행을 넣어 빈 지역 칩 없이 검암·을지로만 표시됨 확인.
- 자체 검증: `npm run bump` 재실행 → `202611031845`; `npm test` → **81 pass / 0 fail**; `git diff --check` 통과. 저장소 밖 기존 Chrome 검증 스크립트에 두 이슈 검증을 추가해 전체 재실행 PASS, 런타임 예외 없음. 실제 폼 전송 없음.
- DoD 자가 체크: [x] PM R-1 빈 시트 재시도 복원 [x] PM R-2 빈 지역 칩 방지 [x] 기존 R-1~R-11 회귀 검증 및 버전 일관성 유지.
- 설계와 다르게 한 점 / 질문: 없음. 커밋·배포하지 않음.

## PM 검증 2차 (클로드)
- 결과: **통과** (R-1~R-11, 1차 이슈 2건 해소)
- 확인: `npm test` 81 pass. `load()` 빈 시트 분기 `els.retry.hidden = false` 복원, `stores.js` 지역 `splitMulti(...)[0]` + 빈 값 제외 필터를 직접 실행해 `,을지로`→`을지로`, ` , `→경고 후 제외 확인. 검증 스크립트 재실행 전 항목 PASS(재시도·빈 지역 칩 포함), 런타임 예외 없음.
- 남은 일(사용자): 계획 §7 — 폼 `지역` 질문 추가 후 entry ID를 `RATING.entries.region`에 입력(그 전까지 평점 기능 꺼짐), 응답 시트 기존 행 `검암` 채우기, 가게 탭 `지역`·`혼잡도` 추가·`사용여부` 삭제. 그 뒤 배포.
