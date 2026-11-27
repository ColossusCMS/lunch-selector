# 033 공지 이미지 — https 주소·크기 지정 (v2.6.1)

## 지시 (PM)
- 설계서: `docs/design/2026-11-27/notice-rich-content-design.md` **10절**(v2.6.1 개정). 설계서와 이 지시서가 다르면 이 지시서를 따르고 보고에 적는다.
- 회차: 최초.
- 시작 시점: `main` = `4a14192`. 작업트리는 깨끗하다. 기존 테스트 190개.
- `images/notice/`에 사용자 샘플 이미지 3장(`sample-image.jpg`, `sample-image1.png`, `sample-image2.png`)이 커밋돼 있다. 지우거나 바꾸지 않는다.

### 목표
1. `{이미지:대상|설명|크기}`에서 대상으로 파일 이름 외에 `https://` 주소도 받는다.
2. 세 번째 칸에 크기(10~100%)를 받는다. 100% 미만이면 가운데 정렬한다.
3. `docs/NOTICE-GUIDE.md`의 이미지 절을 갱신한다(주소·크기·운영 주의 10.3).
4. `APP_VERSION = 'v2.6.1'`, `npm run bump`.

### 하지 말 것
- `README.md`는 고치지 않는다(배지는 PM이 한다). `server/`, `docs/SETUP.md`도 고치지 않는다.
- 이미지 외 문법, 공지 순서·숨김, `parseNotices`는 바꾸지 않는다.
- `innerHTML`류를 쓰지 않는다. style 예외는 검증된 `width` 정수 하나뿐이다.
- 실제 구글 폼으로 전송하지 않는다. 운영 시트를 고치지 않는다. 사용자의 immich 주소는 모르므로 쓰지 않는다. 외부 주소 확인은 공개 테스트 이미지나 로컬 https 대체(가로채기)로 한다.
- 커밋하지 않는다.

### 구현 메모
- `js/notice-markup.js`의 `parseImage`는 이미 `splitLabel`로 대상과 설명을 나눈다. 이를 10.1의 3조각 규칙으로 바꾼다.
- 이미지 노드는 `{type:'image', src, alt, width}`이다. 저장소 파일이면 `src = 'images/notice/' + file`이고, 주소면 `httpsLink` 결과다.
- `js/dialogs.js`는 `src`를 그대로 쓰고, `width < 100`이면 `style.width`와 가운데 정렬 클래스를 준다(클래스명은 판단). `referrerPolicy = 'no-referrer'`는 모든 이미지에 줘도 된다.
- 기존 테스트 중 노드 모양(`file` 필드)을 검사하던 것은 새 모양에 맞게 고친다. 검사의 의도(경로 탈출 거부 등)는 유지한다.

### 완료 조건 (DoD)
- `tests/notice-markup.test.js`에 아래 경계를 추가한다.
  - 대상
    - 통과: 확장자 없는 https 주소, 쿼리(`?key=…&size=preview`)가 붙은 주소
    - 거부: `http://`, `javascript:`, `data:`, `//host/a.png`, 2001자 주소
    - 앞뒤 공백 정리
  - 크기
    - 통과: `10%`, `100%`, ` 60% `, 빈 크기(`|설명|`) → 100
    - 글 줄로 남음: `9%`, `101%`, `60`, `60px`, `abc`, `-10%`, `0%`
  - 조각 수
    - `{이미지:a.png||40%}`는 alt가 제목이다.
    - 4조각은 글 줄이다.
  - 기존 이미지 경계(파일명 정규식, 최대 3장, 글 중간 미해석)가 그대로 통과한다.
- `npm test` 전부 통과(개수 보고). `git diff --check` 통과.
- `grep -n "innerHTML\|insertAdjacentHTML\|outerHTML" js/`로 새 사용처가 없음을 보인다. `style.` 사용처가 width 하나뿐임을 보인다.
- 화면 확인은 `npx serve -l 5173 .`에서 가짜 공지 CSV로 한다. 390폭 라이트에서 아래 네 가지를 확인한다.
  - 저장소 샘플 이미지 100%
  - 같은 이미지 40%(가운데)
  - 외부 https 이미지
  - 불러오기 실패 주소(이미지 제거)
  - 스크린샷은 저장소 밖에 두고 경로만 적는다.
- 가이드는 해요체로 쓰고, immich 주소 예시는 형태만 적는다(실제 호스트·키 금지).

## 완료 보고 (Codex)

### 변경 파일

- `js/notice-markup.js`, `js/dialogs.js`, `css/style.css`, `tests/notice-markup.test.js`, `docs/NOTICE-GUIDE.md`
- `js/config.js`의 v2.6.1 및 `npm run bump`가 갱신한 HTML·JS 참조

### 셀프리뷰

- `npm run bump` 버전 `e12234f78784` 적용. `npm test` 194개(기존 190개와 신규 4개), `node --test tests/version.test.js` 3개, `git diff --check` 통과.
- `rg -n 'innerHTML|insertAdjacentHTML|outerHTML' js/`에는 기존 공개 연출만 나온다. `git diff -U0 -- js/`에서 새 `style.` 사용은 공지 이미지의 검증된 정수 `width` 한 곳이다. README, 서버, SETUP, 저장소 샘플 이미지는 변경하지 않았다.
- `npx --yes serve -l 5173 .`에서 Chrome 390px 라이트 화면과 가짜 CSV로 확인했다. 저장소 이미지의 100% 폭과 가운데 40%, 확장자 없는 가짜 HTTPS 이미지의 가운데 60%, 쿼리 유지와 Referer 헤더 생략을 확인했다. 404를 받은 이미지 요소만 사라지고 다른 이미지·문구는 남았다. 운영 시트 접근과 폼 전송은 각각 0건이었다.
- 화면은 저장소 밖 `/tmp/lunch033-screens/notice-image-sizes.png`, `/tmp/lunch033-screens/notice-image-failure.png`에 있다.

### 판단 및 남은 확인

- 같은 렌더링 경로를 쓰는 모든 공지 이미지에 `no-referrer`를 적용했다. 파일 이름 문법은 기본 폭 100%로 동작한다.
- 사용자의 Immich 주소는 테스트에서 사용하지 않았다. 실제 공지에 적용할 주소는 배포 후 확인할 수 있다.
