# 011 에메랄드 1순위 카드의 빈 스크롤 수정

## 지시 (PM)
- 증상(2026-11-04 사용자 제보): 1순위 카드가 에메랄드 등급일 때, 가게명이 한 줄이고 내용도 짧은데 카드 안에 세로 스크롤이 생긴다. 내려도 아무것도 없다.
- 원인(PM 재현 완료): `.big .card-inner { overflow-y: auto }`(`css/style.css:173`, 긴 내용용) 안에 에메랄드 장식 `.card-crystal`(`css/style.css:197`, 80px·`right/bottom: -20px`·`rotate(45deg)`)이 들어 있어, 회전한 장식이 카드 아래로 약 37px 넘치며 스크롤 가능 영역이 된다. headless Chrome 측정: 일반 scrollHeight 234 = clientHeight 234 → 결정 추가 시 scrollHeight 271, 결정 숨기면 다시 234.
- 수정 방향:
  - 장식 요소(`.card-crystal`, `.card-spark`, `.card-sweep`, 필요하면 `.card-watermark`)를 `.card-inner` 안의 **장식 전용 층**(예: `.card-deco` — `position:absolute; inset:0; overflow:hidden; pointer-events:none; border-radius: inherit`)에 넣는다. 장식은 그 층 기준으로 지금과 **같은 위치·모양**으로 보이게 한다.
  - `.big .card-inner`의 `overflow-y: auto`는 유지(긴 가게명·메모일 때 스크롤은 계속 가능해야 함). 장식 층은 스크롤 내용과 함께 움직여도, 고정돼도 무방하나 내용 높이에 영향을 주지 않을 것.
  - 장식의 겹침 순서(내용 글자보다 뒤)와 애니메이션·reduce 처리 유지.
- 범위: `js/app.js`(`fillCard` 장식 생성 부분), `css/style.css`, 필요 시 테스트, 버전 bump. 다른 동작 변경 금지. 실제 폼 전송 금지.
- DoD:
  - E-1 에메랄드 1순위 카드: scrollHeight == clientHeight(스크롤 없음), 360·400px. 가짜 평점 CSV로 실제 에메랄드 등급을 만들어 확인.
  - E-2 다이아·루비·원석·미확인 1순위 및 2·3순위 카드도 짧은 내용이면 스크롤 없음.
  - E-3 긴 가게명+긴 메모로 내용이 넘치는 1순위 카드는 여전히 세로 스크롤 가능(기존 동작 유지).
  - E-4 장식이 수정 전과 같은 위치·모양으로 보임 — 수정 전/후 에메랄드·다이아 1순위 카드 스크린샷 비교.
  - E-5 `npm test` 전부 PASS, `npm run bump` 후 버전 일관성 통과.
  - E-6 스크린샷 `docs/agents/screenshots/011/`: 에메랄드·다이아 1순위 수정 전/후(라이트), 긴 내용 스크롤 카드 1장.
- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 011 구현 1차. 상세: docs/agents/handoffs/011-emerald-scroll.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 이번 회차 변경 파일: `js/app.js`의 fillCard 장식 생성 부분, `css/style.css`의 `.card-deco` 한 규칙. 버전만 `index.html`, `js/data.js`, `js/select.js` 및 app.js import. 협업 기록: 이 인계 파일·`docs/agents/worklog.md`. 새 캡처9개 `screenshots/011/`. 시작 시 010 미커밋 변경을 유지했고 다른 동작/설정값은 수정하지 않음.
- 구현: `.card-inner` 첫 자식에 aria-hidden 장식 층을 두고 결정·반짝임·스윕·워터마크를 그 안으로 이동. absolute/inset:0·overflow:hidden·border-radius:inherit·pointer-events:none·isolation:isolate로 장식을 잘라 스크롤 크기에 영향을 주지 않게 함. 글자/링크보다 먼저 배치해 장식이 뒤에 그려지도록 유지. 기존 장식 CSS와 `.big .card-inner` overflow-y:auto는 유지.
- 자체 검증: `npm run bump` → `202611041037`; `npm test` **83 pass / 0 fail**; 버전 일관성·`git diff --check` 통과. 실제 폼 전송·커밋·배포 없음.
- DoD 자가 체크:
  - [x] E-1: 가짜 CSV에서 3점 응답2개씩 넣어 실제 에메랄드 등급 생성. 360/400px 모두 수정 전 1순위 clientHeight234 / scrollHeight271 → 수정 후234/234. 가로도 360에서는 clientWidth322 / scrollWidth359→322/322, 400에서는362/399→362/362로 장식 넘침 제거.
  - [x] E-2: 에메랄드·다이아·루비·원석·미확인 5등급 × 360/400 × 1/2/3순위 검증. 짧은 내용에서 1순위234/234, 2·3순위185/185로 스크롤 없음. 가로 scrollWidth==clientWidth도 전부 확인.
  - [x] E-3: 긴 가게명+긴 메모 CSV로 1순위 overflow-y:auto·scrollHeight>clientHeight, scrollTop=80 설정 후 실제80으로 이동함 확인. 캡처 저장.
  - [x] E-4: 에메랄드·다이아 수정 전/후 라이트 캡처 직접 비교. 결정의 회전 후 bounding rect는 360px 1순위 x264.43/y337.43/113.14×113.14, 400px x304.43/y337.43/113.14×113.14로 수정 전후 동일. 결정/반짝임 위치·모양 및 내용의 앞뒤 순서 유지 확인. 정상 모션에서 장식 층 내부 spark/sweep getAnimations()>0, reduce에서0개 및 pointer-events:none 확인.
  - [x] E-5: 전체83개 테스트·버전 일관성 통과, 런타임 예외 없음.
  - [x] E-6: `docs/agents/screenshots/011/`에 before/after-emerald-360/400-light.png, before/after-diamond-360/400-light.png(8개), after-long-scroll.png(1개) 저장.
- 재현: 저장소 밖 `C:/Users/root/AppData/Local/Temp/lunch011-verify.mjs`(프로젝트 루트에서 `node <경로> before` 또는 `after`; before는 수정 전 소스로 이미 실행해 캡처 보존), 가짜 CSV/폼 설정 복사본 `lunch011-check`. 외부 네트워크/실제 폼에 전송하지 않음.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (E-1~E-6)
- 확인: `npm test` 83 pass, diff 검토(`.card-deco` 장식 층 하나 + `fillCard`에서 장식을 그 층으로 이동, `.big .card-inner` overflow 유지). `after-emerald-360-light.png` 직접 확인 — 결정 장식 위치·모양 유지, 스크롤바 없음. 측정값(234/271 → 234/234)은 PM 재현값과 일치.
- 참고: 이번 세션 재시작으로 PM 칸 이름 `lunch-pm`이 풀려 있어 코덱스 완료 메시지가 전달되지 않았다(사용자가 발견). 다시 붙임. 이후 지시 때마다 양쪽 이름을 다시 붙인다.
