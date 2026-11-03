# 005 캐시 섞임 방지·시작 안전망·평가 격리

## 지시 (PM)
- 계획(설계 포함): `docs/superpowers/plans/2026-11-03-cache-safety.md`
- 이번 범위: Task 1~5 전부
- DoD: C-1~C-9 (화면 항목도 자체 확인. PM이 다시 확인한다)
- 주의:
  - 커밋하지 않는다. 기준점은 현재 `HEAD`(사용자가 004·README까지 커밋·푸시함).
  - `js/config.js`의 값은 건드리지 않는다. 실제 구글 폼 전송 금지. 화면 확인은 저장소 밖 복사본.
  - `package.json`은 `scripts.bump` 추가만.
  - 계획과 다르게 해야 할 이유가 생기면 임의로 바꾸지 말고 아래 보고에 질문으로 남기고 멈춘다.
  - 끝나면 아래 "구현 보고 1차" 절을 채우고 턴을 끝낸다(PM이 대기 중).

## 구현 보고 1차 (코덱스)
- 변경 파일: `index.html`, `js/app.js`, `js/data.js`, `js/select.js`(상대 import 버전), `scripts/bump-version.mjs`(신규), `tests/version.test.js`(신규), `package.json`(scripts.bump만), `docs/SETUP.md`, 본 인계 보고 절. js/config.js 변경 없음.
- 자체 검증:
  - 버전 테스트를 먼저 추가해 `css/style.css` 버전 누락 실패 확인 → 도구 구현/실행 후 통과. 최종 `npm run bump`: **202611031655**, 4개 파일 변경. CSS·앱 모듈·모든 상대 import(타입 주석 포함)에 같은 버전 적용.
  - 최종 `npm test`: **79 pass / 0 fail / cancelled 0**, runner 187.2779ms(기존 78개 + 버전 일관성 1개). `node --check js/app.js`, `node --check scripts/bump-version.mjs`, `git diff --check` 통과.
  - 저장소 밖 임시 복사본의 버전을 `199901010000`으로 일괄 설정한 뒤 bump 도구 실행 → 4개 파일이 현재 시각 버전으로 교체, 복사본의 버전 일관성 테스트 통과. 최종 저장소 버전도 별도 bump로 하나로 정리.
  - 로컬 HTTP 서버 + headless Chrome(CDP) 검증: 네트워크의 CSS·모듈 요청 **11개** 모두 같은 ?v 주소. 가챠 카드·평가 모달 정상 시작/표시, 추천 가능.
  - 앱 모듈 404(76ms), rating의 export 누락으로 옛 모듈 혼합 흉내(82ms), 앱 최상위 throw(79ms): 실패 문구·새로 불러오기 확인. 앱 모듈 응답 정지 시 약 **8064ms**에 타이머 안전망 동작. 새로 불러오기 클릭 시 `r` 쿼리 추가 및 기존 쿼리 보존 확인.
  - CSV 응답만 8.25초 지연: __lunchReady는 먼저 true, 불러오는 중... 유지, 안전망 버튼 숨김 유지. 응답 해제 후 목록 정상 표시/돌리기 활성.
  - showModal 삭제 + 31분 지난 기록: 앱 준비/목록 로딩 정상, 모달 생략, last-pick 원문 보존. showModal이 throw하는 별도 시나리오: 평가 초기화 경고만 남고 앱 준비/목록 로딩 정상, 기록 보존.
  - 검증은 OS 임시 폴더의 `lunch-cache-smoke.mjs` 및 서버 메모리의 가짜 설정·CSV 응답으로 실행. 실제 구글 폼 전송 0. `git diff --exit-code -- js/config.js` 통과. package.json은 scripts.bump 추가만 확인.
- DoD 자가 체크:
  - [x] C-1: 로컬 자원/상대 import 버전 존재·일관성 테스트 통과.
  - [x] C-2: bump 첫 적용·이전 버전 일괄 교체·최종 재실행 확인.
  - [x] C-3: 브라우저 네트워크 11개 자원 버전 일치·화면 정상.
  - [x] C-4: 모듈/혼합/실행 오류 즉시 안내, 무응답 8초 안전망, r 쿼리 재이동 확인.
  - [x] C-5: 정상 준비 후 데이터 응답 지연에도 안전망 오작동 없음.
  - [x] C-6: showModal 미지원 시 목록 정상·모달 생략·기록 보존.
  - [x] C-7: 평가 초기화 예외 격리·핵심 시작 유지.
  - [x] C-8: 79개 테스트 통과, 가챠 카드·평가 모달 기본 동작 확인.
  - [x] C-9: 허용 파일만 수정/추가, config 값 동일, 의존성 추가 없음.
- 설계와 다르게 한 점 / 질문: 없음. 시작 안전망은 모듈 앞 classic 인라인으로 구현, 모듈 태그 error와 window error 모두 연결. 준비 신호는 핵심 시작 및 격리된 평가 초기화 이후 맨 끝에서 설정. 커밋·배포하지 않음. PM 최종 검증 대기.

## PM 검증 1차 (클로드)
- 결과: **통과** (C-1~C-9)
- 확인: `npm test` 79 pass, 변경 파일 허용 범위 내(`config.js` 값 변경 없음, `package.json`은 `bump`만). diff 검토: 모든 상대 import·CSS·앱 스크립트에 `?v=202611031655`, 인라인 안전망(8초·`error`·모듈 `onerror`), `initRatings`를 `selectMode` 뒤로 옮기고 `try/catch`, `showModal` 검사, 맨 끝 `__lunchReady`.
- headless Chrome 독립 확인: 정상 시작 시 준비 신호 true·안전망 숨김(9초 뒤에도 유지), 복사본의 `rating.js`에서 export를 빼 옛 파일 섞임을 흉내 → `화면을 불러오지 못했어요` + `새로 불러오기` 표시, 클릭 시 `?x=1&r=…`로 이동(기존 쿼리 보존).
- 이슈: 없음
- 참고(반려 아님): 준비 전에 앱과 무관한 스크립트 오류(브라우저 확장 등)가 나도 안전망 문구가 뜰 수 있다. 앱이 이후 정상 시작하면 데이터 로딩이 메시지를 덮지만 `새로 불러오기` 버튼은 남는다. 드문 경우라 두고, 문제되면 준비 시 버튼을 숨기도록 보완.
