# 018 제외 버튼 문구 `제외하기`

## 지시 (PM)
- 배경(2026-11-05 사용자 요청): 결과 카드의 `🙅 제외` 버튼이 상태 표시처럼 보일 수 있어, 누르는 동작이라는 것이 확실하게 `🙅 제외하기`로 바꾼다.
- 017(제외 포함 체크박스)이 아직 커밋 전이다. 그 변경 위에 이어서 작업하고 017 변경은 건드리지 않는다.

### 할 일
- 결과 카드(1·2·3순위) 버튼 문구 `🙅 제외` → **`🙅 제외하기`**. 누른 뒤의 `제외됨`, 확인창 문구·버튼(`취소`·`제외하기`), `aria-label`은 그대로.
- README·SETUP 등 문서에 버튼 문구 `🙅 제외`가 그대로 적혀 있으면 같이 고친다(README 이미지 재촬영은 하지 않음).
- `APP_VERSION`은 그대로. `npm run bump`는 실행. 의존성 추가·커밋 금지. 화면 확인은 저장소 밖 복사본 + 가짜 CSV.

### DoD
- L-1 Chrome(가짜 CSV, 긴 가게명 포함): 1·2·3순위 카드 모두 `🙅 제외하기`, 누르고 확정하면 `제외됨`·비활성(기존 동작 유지). 360px에서 2·3순위(좁은 카드) 버튼이 한 줄이고 카드 밖으로 넘치지 않음.
- L-2 캡처 `docs/agents/screenshots/018/impl-card-{360,400}-{light,dark}.png`.
- L-3 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과, `git diff --check` 통과.

- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 018 구현 1차. 상세: docs/agents/handoffs/018-exclude-label.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `js/app.js`(공통 카드 버튼 문구), `README.md`(흐름도 버튼 문구). 버전 문자열만 `index.html`·`js/data.js`·`js/select.js` 및 app.js import 갱신. 기록: 이 인계 파일·`docs/agents/worklog.md`, `docs/agents/screenshots/018/` 캡처4개. 017 변경 유지, APP_VERSION v2.2 유지. SETUP에는 해당 버튼 문구가 없어 수정 없음. 기존 이미지 재촬영 없음.
- 구현: 세 순위 공통 카드 생성부의 `🙅 제외`만 `🙅 제외하기`로 변경. 확정 후 `제외됨`·비활성, 확인창 제목·버튼·취소 포커스, aria-label은 기존 그대로.
- [x] L-1: 저장소 밖 복사본·가짜CSV 5곳(긴 가게명 포함)으로 Chrome 확인. 세 순위 모두 새 문구 표시, 확정 시 제외됨·비활성 및 현재 카드명 유지. 360/400 × 라이트/다크에서 버튼 폭87.95px·높이22px, 텍스트 Range.getClientRects() 1개(한 줄), 모든 버튼 경계가 카드 안에 들어옴. 긴 이름을 1순위 및 좁은 3순위에 배치해 검증. 런타임 예외0, 실제 폼 전송0.
- [x] L-2: 지정된 `impl-card-{360,400}-{light,dark}.png`4개 저장, 360px 화면 직접 확인.
- [x] L-3: `npm run bump` → `202611051133`; `npm test` **93 pass / 0 fail**, 버전 일관성 및 `git diff --check` 통과. 의존성 추가·커밋 없음.
- 재현: 프로젝트 루트에서 `node C:/Users/root/AppData/Local/Temp/lunch018-verify.mjs`, 임시 복사본 `C:/Users/root/AppData/Local/Temp/lunch018-check`.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (L-1~L-3)
- 확인: `npm test` 93 pass, `git diff --check` 통과. 카드 버튼만 `🙅 제외하기`로 바뀌었고(app.js 178), 확인창 버튼·`제외됨`은 그대로다. README 흐름도도 같은 문구로 바꿨다. `impl-card-360-light.png`를 직접 열어 봤다. 360px에서 좁은 2·3순위 카드(긴 가게명 포함)에도 버튼이 한 줄로 카드 안에 들어간다.
