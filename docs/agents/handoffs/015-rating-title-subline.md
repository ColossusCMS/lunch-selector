# 015 평가 창 제목 2번째 줄을 작고 연하게

## 지시 (PM)
- 배경(2026-11-04 사용자 승인): 평가 창 제목 `🍱 11/4 점심 추천` / `다녀온 곳이 있으면 평가해 주세요` 중 **2번째 줄만** 한 단계 낮춘다. 사용자가 PM 샘플(`docs/agents/screenshots/015/sample-light.png`, `sample-dark.png`; 현재는 `now-*.png`)을 보고 "밸런스가 더 괜찮다"며 채택했다.
- 변경 (`css/style.css`만, 현재 `.rating-dialog h2 > span { display: block; }` 근처):
  - 2번째 줄(`h2#rating-title`의 두 번째 span) 스타일: `font-size: .82em; font-weight: 400; color: var(--muted); margin-top: 2px;`
  - 첫 줄(모드 이모지·날짜·추천)은 지금 그대로.
  - 선택자는 구조에 맞게 정리해도 되지만(예: `span + span`, 또는 app.js에서 두 번째 span에 클래스 부여) 결과는 샘플과 같아야 한다. `innerHTML` 금지.
- 범위: `css/style.css`, (클래스를 붙인다면) `js/app.js`, `npm run bump`. 실제 폼 전송 금지.
- **`docs/agents/screenshots/015/`의 기존 PM 샘플 4장(now-*, sample-*)은 지우거나 덮어쓰지 않는다.** 새 캡처는 `impl-` 접두.
- DoD:
  - T-1 headless Chrome: 2번째 줄 계산 스타일 font-size = 첫 줄의 약 82%, font-weight 400, color = `--muted` 값(라이트 #8a7f77, 다크 #a8a29e). 첫 줄 스타일은 변경 전과 동일.
  - T-2 점심·카페 모드 모두, 360·400px × 라이트·다크 캡처 `docs/agents/screenshots/015/impl-{lunch,cafe}-{360,400}-{light,dark}.png`. 360px에서 2번째 줄이 한 줄로 들어가는지 확인(넘치면 보고). 샘플과 비교해 같은 모양인지 확인.
  - T-3 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과.
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 015 구현 1차. 상세: docs/agents/handoffs/015-rating-title-subline.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `css/style.css`에 `.rating-dialog h2 > span + span` 규칙 한 줄 추가. 버전만 `index.html`, `js/app.js`, `js/data.js`, `js/select.js`. 기록: 이 인계 파일·`docs/agents/worklog.md`. screenshots/015에 `impl-` 캡처8개 추가.
- 구현: 두 번째 제목 span에 지시된 `.82em`·weight400·var(--muted)·위 여백2px 적용. JS 마크업/로직 변경 없음.
- 자체 검증: `npm run bump` → `202611041325`; `npm test` **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과. 실제 폼 전송·커밋·배포 없음.
- DoD 자가 체크:
  - [x] T-1: Chrome 수정 전/후 computed style 비교. 첫 줄은 점심/카페·360/400·두 테마 모두 font16px·weight700·line-height25.6px 및 기존 색상 그대로. 둘째 줄13.12px(정확히82%)·weight400·margin-top2px, 라이트 rgb138/127/119=#8a7f77·다크168/162/158=#a8a29e 확인.
  - [x] T-2: `impl-{lunch,cafe}-{360,400}-{light,dark}.png` 8개 저장. 모든 조합에서 둘째 줄 실제 높이21px≈line-height20.992px로 추가 줄바꿈 없음. PM sample-light/sample-dark와 직접 비교해 요청한 크기·굵기·보조색의 시각 위계 일치 확인. 기존 now-light/now-dark/sample-light/sample-dark의 SHA256을 작업 전후 비교해 **4장 모두 변경 없음** 확인.
  - [x] T-3: 전체83개 테스트·버전 일관성 통과, Chrome 런타임 예외 없음.
- 재현: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch015-verify.mjs`(프로젝트 루트에서 node, before/after 인자), 가짜 설정/CSV 복사본 `lunch015-check`; 수정 전 computed style `lunch015-check/baseline.json`, PM 원본 해시 `lunch015-original-hashes.json`. 실제 폼 요청 없음.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (T-1~T-3)
- 확인: `npm test` 83 pass. CSS 변경은 `span + span` 규칙 한 줄이고, js·html은 버전 문자열만 바뀌었다. `impl-cafe-360-dark.png`를 직접 열어 봤다. 가장 좁은 화면, 다크 테마, 긴 가게명 조건에서도 2번째 줄은 한 줄로 작고 연하게 보이고, 샘플과 같은 위계다.
