# 001 버그 수정 1차 (B1~B4, B6′ 주석)

## 지시 (PM)
- 설계: `docs/superpowers/specs/2026-11-03-bugfix-batch1-design.md`   계획: `docs/superpowers/plans/2026-11-03-bugfix-batch1.md`
- 이번 범위: 계획의 Task 1~4 전부
- DoD: 계획의 "DoD (완료 기준)" 절 D-1~D-8 (D-9 화면 확인은 PM이 한다)
- 주의:
  - 커밋하지 않는다. 파일 수정까지만.
  - 설계 범위 밖(B5 중복 행, B6 캐시 동작, B7 SDK, 문구 개선)은 건드리지 않는다.
  - 계획과 다르게 해야 할 이유가 생기면 임의로 바꾸지 말고 아래 보고에 질문으로 남기고 멈춘다.
  - 끝나면 아래 "구현 보고 1차" 절을 채우고 턴을 끝낸다(PM이 대기 중).

## 구현 보고 1차 (코덱스)
- 변경 파일: `js/stores.js`, `js/data.js`, `js/app.js`, `js/config.js`, `js/map.js`, `tests/stores.test.js`, `tests/data.test.js` (소스·테스트 7개), 본 인계 파일(구현 보고).
- 자체 검증: Task 순서대로 테스트 추가 → 실패 확인 → 구현 → 통과 확인. Task 1은 `아니요` assertion 실패, Task 2는 signal 무시 fetch에서 멈춤 확인 후 Ctrl+C로 종료, Task 3·4는 export 누락 실패 확인. 최종 `npm test`: **64 pass / fail 0 / cancelled 0**, runner 145.5914ms, npm 명령 약 0.9초 이내 종료. `git diff --check` 통과.
- DoD 자가 체크:
  - [x] D-1: 미사용 값 확장 및 기존 true 값 테스트 통과.
  - [x] D-2: 응답·본문 지연 reject, `시간 초과` 메시지, signal·no-store 테스트 통과. 기본 timeout 10000ms 코드 확인.
  - [x] D-3: 성공·실패 모두 finally에서 타이머 정리. 전체 테스트 정상 종료.
  - [x] D-4: 카운터 테스트 통과. load 시작마다 번호 발급, 성공·실패 두 검사 교체. retry도 같은 load 호출 유지.
  - [x] D-5: 저장값·첫 모드·null 테스트 통과. 모드 0개 안내 및 돌리기 비활성 연결 diff 확인.
  - [x] D-6: map.js는 지정 주석 한 줄만 변경.
  - [x] D-7: 기존 59개 + 신규 5개 = 64개 통과.
  - [x] D-8: git diff --stat의 추적 파일 변경은 지정 소스·테스트 7개만. package.json·의존성 변경 없음.
  - [ ] D-9: 지시대로 실제 화면 확인은 PM에게 인계.
- 설계와 다르게 한 점 / 질문: 없음. 제한 시간 테스트는 계획의 reject 확인에 더해 `시간 초과` 메시지도 검사. 커밋·배포하지 않음.

## PM 검증 1차 (클로드)
- 결과: **통과** (D-1~D-8). D-9 화면 확인은 브라우저 확장 미연결로 PM이 수행하지 못해 사용자 확인으로 넘김.
- 확인한 것:
  - `npm test` 재실행 → 64 pass / 0 fail, 161ms (D-3·D-7)
  - `git diff --stat` → 지정 7개 파일만 (D-8)
  - diff 검토: `DISABLED_VALUES` 확장(D-1), `loadStores` 기본 10000ms·signal·no-store·`Promise.race`+`finally clearTimeout`(D-2·D-3), `load()` 두 검사 `isLatest` 교체(D-4), `initialMode` + 0개 시 안내·돌리기 비활성(D-5), `map.js` 주석 한 줄(D-6)
  - `Promise.race`가 늦게 거절된 요청도 구독하므로 처리되지 않은 거절은 생기지 않음
  - 로컬 서버(127.0.0.1:8765)에서 `index.html`·수정 JS 200 응답, `node --check js/app.js` 통과
- 이슈: 없음
