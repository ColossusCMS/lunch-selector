# 007 별점 선택 시각 강화

## 지시 (PM)
- 계획(설계 포함): `docs/superpowers/plans/2026-11-03-rating-stars-visual.md`
- 이번 범위: Task 1~4 전부
- DoD: S-1~S-6 (화면 항목도 자체 확인. PM이 다시 확인한다)
- 주의:
  - 커밋하지 않는다. 사이클 006 변경은 사용자가 커밋했다고 가정하지 말고, `git status`로 기준을 확인한 뒤 이번 회차 변경 파일을 보고에 정확히 적는다.
  - 모달 폭·제목 줄바꿈은 이번 범위 아님(다음 사이클). 레이아웃은 크게 바꾸지 않는다.
  - 색 값·효과 세부는 재량. 그 밖에 계획과 다르게 해야 할 이유가 생기면 보고에 질문으로 남기고 멈춘다.
  - 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 007 구현 1차. 상세: docs/agents/handoffs/007-rating-stars-visual.md"`를 보내고 턴을 끝낸다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `css/style.css`, `js/app.js`(평가 모달 별 렌더링·starLabel import), `js/rating.js`(starLabel), `tests/rating.test.js`. 버전 갱신만: `index.html`, `js/data.js`, `js/select.js` 및 app.js import. 기록: 이 인계 파일·`docs/agents/worklog.md`.
- 기준 확인: 시작 시 사이클 006 소스·문서 변경이 모두 미커밋 상태였음. 기존 변경을 유지했으며 `js/config.js`의 사용자가 연결한 region entry 포함 설정값은 변경하지 않음. README 등 이번 범위 밖 파일 추가 수정 없음.
- 구현: 1~N번 별에 `.filled` 금색 글자·배경·테두리(라이트/다크 변수), 미선택 별은 회색. N번째 `aria-pressed=true` 동작 유지. 별 줄 아래 항상 높이를 확보하는 문구 줄을 두고 `starLabel()` 결과를 textContent로 표시. 선택할 때 채워진 별만 0.2초 scale 1→1.2→1 효과, 연속 클릭 시 재시작, 해제·reduce 설정에서는 효과 없음.
- 자체 검증: 테스트 먼저 추가해 starLabel export 미구현으로 실패 확인 → 구현 후 전체 **82 pass / 0 fail**. `npm run bump` → `202611031901`; 버전 일관성 테스트 및 `git diff --check` 통과.
- 화면 검증: 저장소 밖 복사본 `C:/Users/root/AppData/Local/Temp/lunch007-check`, 가짜 CSV·가짜 폼 서버와 Chrome headless/CDP 사용. 스크립트 `C:/Users/root/AppData/Local/Temp/lunch007-verify.mjs`(프로젝트 루트에서 `node <경로>`). 400px 스크린샷 `lunch007-check/light.png`, `dark.png` 직접 확인. 실제 구글 폼 전송 없음.
- DoD 자가 체크:
  - [x] S-1: 4점 클릭 시 filled 4개·pressed 1개, 같은 별 재클릭 시 모두 해제·문구 비움·효과 없음 Chrome 검증.
  - [x] S-2: 400px 라이트/다크 캡처에서 금색 선택·회색 미선택 구분 확인. computed color/background도 서로 다름 확인.
  - [x] S-3: starLabel 1~5점 정확한 문구와 범위 밖/문자열/null 처리 단위 검증. Chrome에서 1~5점 문구와 선택 전후·해제 후 모달 높이 동일 확인.
  - [x] S-4: getAnimations()로 star-pop 실행 확인, 연속 클릭 후 animation startTime 변경 확인. reduce에서 animationName=none·실행 애니메이션 0개 확인.
  - [x] S-5: 전체 테스트 통과. Chrome 초기 보내기 비활성·선택 후 활성·해제 후 비활성, 좋아요 on/off, 가짜 POST 별점=4·좋아요=1·지역=검암 확인. 다음에/닫기는 기록 유지, 안 갔어요는 기록 삭제 확인. 런타임 예외 없음.
  - [x] S-6: 이번 변경은 허용 소스·테스트·버전·협업 기록만. 설정값·전송/기록 로직·모달 폭/제목·좋아요 로직 변경 없음, 의존성 추가·커밋·배포 없음.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (S-1~S-6)
- 확인: `npm test` 82 pass, `config.js` 연결값 유지, diff 검토(`starLabel`, `.filled`·변수 3테마, 문구 줄 `min-height`, `star-pop` + reduce 블록). 별도 가짜 설정으로 400px 라이트·다크 모달 스크린샷 직접 확인 — 4점 선택 시 1~4 채움·5 회색·`맛있어요` 표시, 문구 없는 가게도 줄 높이 확보.
- 참고(반려 아님, 사용자 판단): 라이트 테마의 채운 별 색(`#875500`)이 금색보다 갈색에 가깝게 보인다. 대비를 위한 선택으로 보이며, 사용자 피드백에 따라 조정.
