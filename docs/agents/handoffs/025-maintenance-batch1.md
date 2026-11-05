# 025 정비 1차 (H-7·H-3·H-4·H-6·H-1·H-2)

## 지시 (PM)
- 출처: `docs/handoff/2026-11-05/maintenance-issues.md`(외부 분석, 기준 `bb05873`). PM이 2026-11-05 다시 확인했다.
  - H-1: `김밥,김밥,국밥,냉면`으로 10만 회 추첨 → 김밥 1순위 50.1%, 순위 중복 50.2%. 운영 시트(점심 58·카페 15)에는 지금 중복이 없다(예방 수정).
  - H-2: 복사본에서 `js/exclude.js`만 고치고 bump 없이 `tests/version.test.js` → 통과(재현).
  - H-4: 로그인 없이 시트 gviz 주소 요청 → **HTTP 401**. 시트는 링크 공개가 아니다. README 설명(공유 범위 좁게 + 웹 게시 CSV)이 맞고 SETUP이 틀렸다.
- 이번 범위: 아래 6건을 **이 순서대로**(쉬운 것부터). **H-5는 제외**(사용자가 휴대폰에서 재현 여부 확인 중).
- 하지 말 것: 연출(`js/reveal.js`, `js/reveal-plan.js`)과 기능 동작 변경, `js/config.js` 운영 값 변경, 런타임 의존성 추가, **실제 구글 폼 전송**(화면 확인은 가짜 CSV·가짜 폼 주소). `APP_VERSION`은 그대로. 커밋 금지.
- 로컬 실행은 `npx serve -l 5173 .`.

### 1. H-7 `index.html`의 옛 버전
- `index.html:23` `<span id="app-version" class="app-version">v2.1</span>`의 내용을 비운다. 표시는 `js/app.js:762-763`이 이미 처리한다(빈 값이면 숨김). 처음 그릴 때 빈 span이 자리를 차지하지 않는지 확인한다(필요하면 `hidden` 속성으로 시작).

### 2. H-3·H-4 `docs/SETUP.md` 바로잡기 (문서만)
- 17행 탭 이름 `가게목록` → 실제 운영처럼 탭 이름은 자유이고 `js/config.js`의 `MODES`(예: `점심메뉴`, `다과(커피)메뉴`)에 맞춘다는 설명으로.
- 54행 "새로고침만 하면 반영" → 웹 게시 방식은 반영까지 최대 5분 걸릴 수 있다는 점을 적는다(gviz 방식은 바로 반영).
- 92행 `npx serve .` → `npx serve -l 5173 .`(카카오 키에 등록된 포트; 63행과 맞춘다).
- 37행 공유 절 + 68~70행 "대안: 웹에 게시": **웹 게시(CSV)를 기본 방식**으로 설명하고, 시트 공유는 편집할 사람만 지정한다(링크 공개 아님). "링크가 있는 모든 사용자/편집자"는 `PUBLISH_URL`을 비워 gviz 방식으로 쓸 때만 필요한 **대안**으로 옮기고, 그 경우 주소를 아는 누구나 시트를 고칠 수 있다는 위험을 한 줄 적는다. "✏️ 가게 목록 편집하기" 링크는 권한이 있는 사람만 열린다는 점도.
- 80행 "평점 탭만 게시" ↔ README 167·195행(전체 문서 게시, `gid`로 탭 선택, 숨긴 응답 탭도 읽힘)이 충돌한다. 실제 `config.js`의 `RATING.csvUrl`은 가게 목록과 같은 게시 주소에 `gid`만 다르다 → README 쪽으로 맞춘다.
- README는 위 내용과 충돌하는 곳만 고친다(지금 기준 충돌 없음이면 손대지 않아도 된다).

### 3. H-6 카카오 SDK 중복 삽입 (`js/map.js` `loadSdk`)
- 지금: 8초 타임아웃 → reject → `sdk = null`이지만 넣은 `<script>`는 남고, 늦게 끝난 첫 스크립트의 `onload`가 `kakao.maps.load`를 또 부른다. 다음 시도에서 같은 스크립트가 하나 더 들어간다.
- 기대: 실패(타임아웃·onerror) 시 그 `<script>`를 제거하고, 이미 끝난(실패 처리된) 시도의 늦은 `onload`는 아무것도 하지 않는다. 다음 시도에는 문서에 SDK `<script>`가 하나만 있다. 성공 경로·지도 동작은 그대로.
- 방법은 맡긴다. 가능하면 `document`를 주입할 수 있게 해서 `tests/map.test.js`에 가짜 DOM 단위 테스트를 추가한다(타임아웃 뒤 재시도 시 script 1개, 늦은 onload 무시). 어렵다면 브라우저에서 SDK 주소를 막아 확인한다.

### 4. H-1 같은 가게 행 합치기 (`js/stores.js` `rowsToStores`)
- 같은 `지역 + 가게명`(앞뒤 공백 제거 후 일치)은 한 가게로 합친다.
- `groups`·`categories`는 **합집합**(첫 등장 순서 유지, 중복 제거). 나머지 열(정기휴무·혼잡도·메모·주소)은 **첫 행 값**. 합칠 때마다 `console.warn`(어느 지역의 어느 가게가 몇 행인지).
- 가게명을 바꾸지 않는다(평점 키 `모드+지역+가게명` 유지).
- `tests/stores.test.js`에 추가: 합치기·합집합·첫 행 값 유지·다른 지역 같은 이름은 별개·경고 출력. `tests/select.test.js`(또는 적절한 곳)에 중복 행 입력 → `pickTop` 결과에 같은 가게가 두 번 나오지 않음.

### 5. H-2 버전을 콘텐츠 해시로 (`scripts/bump-version.mjs`, `tests/version.test.js`)
- 지금은 bump가 시각(`\d{12}`)을 붙이고 테스트는 "모두 같은 값"만 본다 → bump를 빼먹어도 통과.
- 바꿀 것: 버전 = `css/*.css`·`js/*.js` 내용에서 `?v=…`를 뺀 뒤 해시한 값(예: SHA-256 앞 12자 hex, Node 내장 `node:crypto`). 파일 순서는 이름순으로 고정.
- **줄바꿈 정규화 필수**: 이 PC는 `core.autocrlf=true`라 작업 트리는 CRLF, 저장소·배포는 LF다. 해시 전에 `\r\n` → `\n`으로 바꿔 어느 환경에서 계산해도 같은 값이 나오게 한다.
- 해시 계산 함수는 한 곳(예: `scripts/version-hash.mjs`)에 두고 bump와 테스트가 같이 쓴다.
- 테스트: 기존 "모두 같은 버전" 검사 유지 + 그 값이 지금 소스로 다시 계산한 해시와 같은지 검사. 형식 정규식 `\?v=\d{12}`도 새 형식으로.
- `docs/SETUP.md:107`의 bump 설명("같은 시각 버전")을 내용 해시로 고친다. 바뀐 파일이 없으면 bump를 다시 돌려도 버전이 바뀌지 않는다는 점도.

### 마지막
- `npm run bump` 실행 → `npm test` 전부 통과(기준 103 + 추가분). 테스트 수가 적힌 README 문구가 있으면 갱신.

### DoD
- M-1 (H-7) `index.html`에 `v2.1` 문자열 없음. Chrome에서 버전 배지가 `v2.3`으로 보이고, 로드 직후 옛 버전이 보이지 않음.
- M-2 (H-3·H-4) SETUP 17·54·92·37·68~70·80·107행 상당 부분이 위 지시대로 바뀌고, README와 공유·게시 설명이 충돌하지 않음(바꾼 문장 목록을 보고에 적는다).
- M-3 (H-6) 단위 테스트(또는 브라우저 확인): 타임아웃 뒤 재시도 시 SDK `<script>` 1개, 늦은 onload 무시. 정상 키로 Chrome에서 지도 핀이 뜸(회귀 없음).
- M-4 (H-1) 위 단위 테스트 통과. 가짜 CSV에 중복 행을 넣어 Chrome에서 돌렸을 때 1~3순위에 같은 가게가 겹치지 않음. 운영 CSV를 읽기만 해서 합치기 전후 가게 수가 같음(점심 58·카페 15) 확인.
- M-5 (H-2) 복사본(또는 되돌릴 수 있는 상태)에서: 소스 한 줄 수정 + bump 없이 `npm test` → **실패**, `npm run bump` 뒤 → 통과. 변경 없이 bump를 두 번 돌리면 버전 동일. 확인 뒤 시험용 수정은 되돌린다.
- M-6 `npm test` 전부 PASS, `git diff --check` 통과, 실제 폼 전송 0, 의존성 추가 0, `reveal*.js`·`config.js` 변경 0(버전 import 문자열 제외).

- 끝나면 아래 "구현 보고 1차" 절을 채우고 `herdr agent prompt lunch-pm "[codex→pm] 완료 025 구현 1차. 상세: docs/agents/handoffs/025-maintenance-batch1.md"`를 보내고 턴을 끝낸다. 커밋하지 않는다.

## 구현 보고 1차 (코덱스)

- 지정된 H-7 → H-3·H-4 → H-6 → H-1 → H-2 순서로 구현. H-5 제외.
- 이번 회차 변경 파일: `index.html`, `docs/SETUP.md`, `js/map.js`, `js/stores.js`, `scripts/bump-version.mjs`, 신규 `scripts/version-hash.mjs`, `tests/map.test.js`, `tests/stores.test.js`, `tests/select.test.js`, `tests/version.test.js`, `README.md`(테스트 수만111). 버전 문자열만 `js/app.js`·`js/animation.js`·`js/data.js`·`js/select.js`·`js/reveal.js` 갱신. 기록: 이 인계 파일·`docs/agents/worklog.md`. 공용 지식의 기존 캐시 문서 `shared/docs/knowledge/reference_gh_pages_es_module_cache_mix.md`에 시각→콘텐츠 해시 전환을 추기.

### 구현 및 검증

- [x] M-1 / H-7: index의 옛 v2.1 텍스트를 지우고 빈 span+hidden으로 시작. Chrome에서 app.js 요청을 잠시 보류한 상태로 `{text:'', hidden:true, width:0, height:0, display:'none'}` 확인. 모듈을 진행시키면 기존 app.js 표시 로직으로 v2.3·hidden=false 확인. index.html에 v2.1 문자열0.
- [x] M-2 / H-3·H-4: SETUP의 바꾼 문장/절은 다음과 같음. README 공유/게시 설명과 충돌 없음(README는 테스트 숫자만 변경).
  - 탭 이름 고정 `가게목록` → 이름은 자유, config의 MODES와 맞춤, 운영 예 `점심메뉴`·`다과(커피)메뉴`.
  - 공유: 기본은 편집할 사람만 지정, 웹 게시 CSV를 읽으므로 링크 공개 불필요. 편집 링크는 권한 있는 사람만 열림.
  - 연결: 전체 문서 CSV 웹 게시를 기본 절로 올리고 PUBLISH_URL·gid·SHEET_ID 편집 링크 역할 설명.
  - 반영 시간: 웹 게시 수정은 최대5분 정도 지연될 수 있고 이후 새로고침, gviz는 수정 후 새로고침하면 바로 반영.
  - 기존 웹 게시 대안 절 → PUBLISH_URL을 비운 gviz 대안. 링크가 있는 모든 사용자 설정과 편집자 선택 시 주소를 아는 누구나 수정할 수 있는 위험 명시.
  - 평점: 탭만 게시/별도 시트 대체 설명을 제거하고, 가게 목록과 같은 전체 문서 게시 주소의 평점 gid로 읽도록 통일. 숨긴 응답 탭도 읽힘과 숨김/접근 제한 구분 설명.
  - 로컬 명령 `npx serve .` → `npx serve -l 5173 .`.
  - 배포: 시각 버전 → 파일명순 CSS/JS 콘텐츠 해시, 기존?v 제외·CRLF→LF·무변경 시 버전 유지·bump 누락 테스트 실패 설명.
- [x] M-3 / H-6: createSdkLoader로 문서/타이머/SDK 접근을 주입. 실패 시 타이머·핸들러 정리와 해당 script 제거, finished로 늦은 onload/maps.load 콜백 무시. 성공은 기존 promise 공유·SDK 재사용 유지. 가짜 DOM 테스트3개: 타임아웃/재시도 script1개 및 이전 onload 호출0, onerror 제거/재시도·동시 요청 공유/성공 후 삽입 없음, maps.load 중 타임아웃 뒤 이전 완료 콜백 무시. Chrome 정상 키 회귀: 가짜 가게 주소로 실제 SDK1개·지도 핀3개(`김밥`/`냉면`/`국밥`)·타일7개 로드 확인.
- [x] M-4 / H-1: 정규화 후 `[지역, 가게명]` 키로 합침. 그룹/업종은 Set 합집합으로 첫 등장 순서 유지, 그 밖의 필드는 첫 정규화 행 값 그대로(빈 값도 유지). 병합마다 지역/이름/원본 시트 행 번호 목록/개수 경고. 빈 가게명 행을 건너뛰어도 실제 시트 행 번호 유지. 테스트3개 추가(합집합·첫 행/입력 보존·다른 지역/경고, 중복 입력→추첨 중복 방지). Chrome의 김밥2행+국밥+냉면 가짜CSV를25회 추첨해 매번 서로 다른3가게 확인. 운영 CSV는 읽기만 했고 점심58→58, 카페15→15, 경고0으로 확인.
- [x] M-5 / H-2: 공통 sourceVersion/hashSources가 css/*.css·js/*.js 내용을 파일명순으로 모아 기존?v를 빼고 CRLF를 LF로 정규화한 SHA-256 앞12자리 hex 계산. bump와 버전 테스트가 같은 함수 사용. 기존 모든 참조 버전 일치 검사에 현재 소스 해시 비교를 추가. LF/CRLF·버전표기·파일 순서 불변, JS/CSS 내용/파일명 변경 감지 테스트2개 추가.
  - 저장소 밖 복사본 `C:/Users/root/AppData/Local/Temp/lunch025-version-bJfoCW`의 exclude.js에 검증용 주석1줄 추가 후 **bump 없이 전체 테스트 exit1**(버전 테스트의 bump 안내 확인).
  - 복사본 bump → `cbc87ed63c3a`, 전체111개 통과. 검증용 변경을 원본 바이트로 복원하고 bump하여 `cb6fa6de494c`로 복귀, 전체 통과.
  - 변경 없이 복사본에서 bump2회와 실제 작업 트리에서 bump2회 모두 같은 버전·파일 변경0.
- [x] M-6: 최종 `npm test` **111 pass / 0 fail**(기존103 + SDK3 + stores2 + select1 + hash2), `git diff --check` 통과. 최종 해시 **cb6fa6de494c**. 운영 config/APP_VERSION·reveal-plan.js는 변경0, reveal.js/app.js/animation.js/data.js/select.js는 버전표기 제거 후 HEAD와 완전히 동일함을 비교. package.json 변경0, 런타임 의존성 추가0. 브라우저 실제 폼 POST0·전송 시도0·런타임 예외0. 연출/H-5 기능 수정·커밋·푸시·배포 없음.

### 재현

- `node C:/Users/root/AppData/Local/Temp/lunch025-version.mjs` — 복사본 생성·bump 누락 실패·bump 후 통과·검증 변경 복원·반복 bump 동일 확인. 운영 시트 수는 실제 게시 CSV를 fetch/parse 후 rowsToStores로 읽기만 확인.
- 화면은 `C:/Users/root/AppData/Local/Temp/lunch025-browser-vrbgbd` 복사본에서만 가짜CSV·가짜 폼/평점 주소 사용. 키는 정상 운영 JavaScript 키 유지, `npx --yes serve -l 5173 .`로 localhost:5173에서 실행. 촬영/확인 후 서버와 Chrome 종료.
- `lunch025-browser.mjs` — 초기 버전 hidden·v2.3 표시·중복CSV25회·실제 SDK 핀 검증. TEMP/lunch025-check/의 initial-hidden.png, duplicates-map.png, result.json으로 재현 자료 보관. `lunch025-scope.py` — 보호 파일은 버전 문자열 외 변경 없음을 대조.
- 설계와 다르게 한 점 / 질문: 없음.

## PM 검증 1차 (클로드)
- 결과: **통과** (DoD 6/6)
- `npm test` 111 pass / 0 fail, `git diff --check` 통과. 변경 파일이 보고 목록과 일치함(+ 공용 지식 캐시 문서 추기).
- M-1 `index.html`에 `v2.1` 없음, `hidden` 빈 span으로 시작. `app.js:762-763` 표시 로직 그대로.
- M-2 SETUP diff 검토: 탭 이름·공유(편집자만 지정)·웹 게시 기본/gviz 대안과 위험·반영 지연·평점 전체 문서 게시+gid·`-l 5173`·bump 해시 설명. README와 충돌 없음(README는 테스트 수만).
- M-3 `createSdkLoader`: 실패 시 script 제거·핸들러 해제, `finished`로 늦은 onload/maps.load 무시, 재시도 허용. 가짜 DOM 테스트 3개 확인.
- M-4 `rowsToStores`: `[지역, 가게명]` 키 병합, groups·categories 합집합, 나머지 첫 행, 경고에 시트 행 번호. 가게명 변경 없음(평점 키 유지).
- M-5 PM 독립 재현(저장소 밖 복사본): `css/style.css`에 한 줄 추가 → bump 없이 version 테스트 **fail**("npm run bump를 실행하세요") → bump(`a60895e77bf0`, 6개 파일) → pass → 재실행 시 0개 파일 변경.
- M-6 `config.js`·`reveal-plan.js` 변경 없음, `reveal.js` 등은 import 버전 문자열만. 의존성 추가 없음.
- 남은 것: H-5(사용자 휴대폰 확인 대기).
