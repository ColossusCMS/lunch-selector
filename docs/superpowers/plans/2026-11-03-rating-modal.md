# 평가 카드 → 가운데 모달 Implementation Plan

> **For agentic workers:** 협업 규약에 따라 코덱스가 구현하고 인계 파일 `docs/agents/handoffs/003-rating-modal.md`의 "구현 보고"를 채운다. **커밋하지 않는다.**

**Goal:** 화면 맨 위에 끼어들던 평가 카드를 화면 가운데 모달로 바꾼다.

**왜 (사용자):** 이미 안정적으로 완성된 화면 위에 평가 항목이 맨 위에 붙으니 안정감이 사라지고, 급하게 붙인 기능처럼 보인다. 기존 화면은 그대로 두고 평가는 그 위에 잠깐 얹혔다 사라지게 한다.

**Spec:** `docs/superpowers/specs/2026-11-03-rating-design.md`의 "평가 카드" 절에서 **표시 방식과 닫기 버튼만** 아래로 바꾼다. 표시 조건(30분·달력 3일), 저장 형식, 전송·`applySendResults`·`dropIfSame` 동작, 문구는 그대로다.

## 바뀌는 것 (사용자 결정 + PM 판단)

| 항목 | 내용 |
|---|---|
| 표시 | 네이티브 `<dialog>` + `showModal()`. 화면 가운데, 뒤 배경 어둡게(`::backdrop`). 기존 맨 위 카드 자리(`#rating-card` 섹션)는 없앤다 |
| 내용 | 제목, 가게별 별 5개·👍 — 지금과 같음 |
| 버튼 | 오른쪽 위 `✕` + 아래 `보내기` · `안 갔어요` · `다음에` (이 순서) |
| `✕`·`다음에` | 같은 동작: 이번에만 닫고 저장값은 그대로(다음 접속 때 다시 물음). `✕`의 `aria-label`은 `다음에 평가하기` |
| Esc | `다음에`와 같음(브라우저 기본 cancel 동작을 그대로 쓰되 저장값 보존) — PM 판단 |
| 바깥(backdrop) 클릭 | **닫히지 않음**(별 고르다 실수로 선택이 날아가는 것 방지) — PM 판단 |
| 포커스 | 열리면 모달 안, 닫히면 원래 화면 — `<dialog>` 기본 동작 |
| 전송 후 | 성공: `고마워요! 반영까지 몇 분 걸릴 수 있어요` 표시 후 3초 뒤 닫힘. 실패: `보내지 못했어요. 다음에 다시 물어볼게요` 표시, 버튼은 `다음에`만 남김 |
| 디자인 | 기존 톤(강조색·칩·둥근 모서리), 라이트/다크, 좁은 화면(360px)에서 가로 넘침 없음, 긴 가게명 줄바꿈. 세부는 구현자 재량 |

## Global Constraints

- 수정 범위: `index.html`, `css/style.css`, `js/app.js`(평가 카드 표시·버튼 부분)만. `js/rating.js`·테스트 로직 변경 없음.
- 의존성 0, `textContent`만, 기존 76개 테스트 유지.
- 평가 설정(`js/config.js`의 `RATING`)은 **건드리지 않는다**(사용자가 실제 값을 넣어 둠).

## Tasks

- [ ] **Task 1:** `index.html`의 `#rating-card` 섹션을 `<dialog id="rating-dialog" class="rating-dialog" aria-labelledby="rating-title">`로 교체(위치는 `main` 밖이나 끝 등 구현자 재량).
- [ ] **Task 2:** `js/app.js` `showRatingCard` → 내용을 dialog에 그리고 `showModal()`. 버튼 구성·동작은 위 표대로. `cancel` 이벤트(Esc)는 `다음에`와 같은 처리. backdrop 클릭으로 닫히지 않게(기본이 그렇다면 그대로). 기존 `card.hidden` 처리는 `dialog.close()`로.
- [ ] **Task 3:** `css/style.css` — 기존 카드 스타일을 모달용으로 옮김, `::backdrop`, 최대 너비·여백·스크롤(내용이 길면 모달 안에서 스크롤).
- [ ] **Task 4:** `npm test` 전부 PASS, 로컬 확인.

## DoD

| ID | 기준 | 확인 방법 |
|---|---|---|
| M-1 | 조건 맞으면 가운데 모달로 열리고, 기존 맨 위 카드 자리 없음 | 화면 확인 + `git diff index.html` |
| M-2 | 버튼 `✕` + `보내기`·`안 갔어요`·`다음에` 순서 | 화면 확인 |
| M-3 | `✕`·`다음에`·Esc는 닫기만 하고 `last-pick` 유지, 다음 접속 때 다시 열림 | 화면 확인 + localStorage |
| M-4 | backdrop 클릭으로 닫히지 않음 | 화면 확인 |
| M-5 | 보내기 성공 시 문구 후 3초 뒤 닫힘, 실패 시 문구 + `다음에`만 | 화면 확인(가짜 전송) |
| M-6 | 전송·안 갔어요의 저장값 처리는 002와 동일 | 기존 테스트 PASS + 화면 확인 |
| M-7 | 라이트/다크, 360px 폭에서 넘침·겹침 없음 | 스크린샷 |
| M-8 | 회귀·범위 | `npm test` 76 pass, 변경 파일 3개(`index.html`, `css/style.css`, `js/app.js`)만, `js/config.js` 변경 없음 |
