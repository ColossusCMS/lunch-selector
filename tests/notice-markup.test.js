import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNoticeMarkup } from '../js/notice-markup.js';
import { parseNotices } from '../js/notice.js';

const text = (value) => ({ type: 'text', value });
const style = (className, tag, ...children) => ({ type: 'style', className, tag, children });
const paragraph = (...lines) => ({ type: 'paragraph', lines });
const link = (label, href) => ({ type: 'link', text: label, href });
const image = (src, alt, width = 100) => ({ type: 'image', src, alt, width });
const localImage = (file, alt, width) => image('images/notice/' + file, alt, width);
const bold = (...children) => style('notice-bold', 'strong', ...children);
const color = (name, ...children) => style('notice-color-' + name, 'span', ...children);

test('굵게, 네 가지 색과 여러 본문 링크를 해석한다', () => {
  assert.deepEqual(parseNoticeMarkup(
    '{굵게:중요} {빨강:빨강}{파랑:파랑}{초록:초록}{주황:주황} {링크:안내| https://example.com/a } {링크:신청|https://example.com/b}',
  ), [paragraph([
    bold(text('중요')), text(' '), color('red', text('빨강')), color('blue', text('파랑')),
    color('green', text('초록')), color('orange', text('주황')), text(' '),
    link('안내', 'https://example.com/a'), text(' '), link('신청', 'https://example.com/b'),
  ])]);
});

test('굵게와 색을 중첩하고 다섯째 단계부터 글자로 둔다', () => {
  assert.deepEqual(parseNoticeMarkup('{굵게:{빨강:오늘}} {파랑:{굵게:오늘}만}'), [paragraph([
    bold(color('red', text('오늘'))), text(' '), color('blue', bold(text('오늘')), text('만')),
  ])]);
  assert.deepEqual(parseNoticeMarkup('{굵게:{빨강:{파랑:{초록:{주황:본문}}}}}'), [paragraph([
    bold(color('red', color('blue', color('green', text('{주황:본문}'))))),
  ])]);
});

test('짝이 없는 여는 문법, 빈 값, 모르는 종류와 일반 중괄호를 글자로 둔다', () => {
  assert.deepEqual(parseNoticeMarkup('{굵게:닫지 않음 {빨강:오늘}\n보통}'), [
    paragraph([text('{굵게:닫지 않음 '), color('red', text('오늘'))], [text('보통}')]),
  ]);
  const plain = '{보라:보라} {참고} {굵게:} {파랑: }';
  assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
});

test('링크의 누락 구분자·빈 글씨·비 HTTPS를 거부하고 링크 문구는 문자 그대로 둔다', () => {
  for (const plain of ['{링크:https://example.com}', '{링크: |https://example.com}',
    '{링크:공지|http://example.com}', '{링크:공지|javascript:alert(1)}',
    '{링크:{굵게:안내}|http://example.com}', '{링크:안내|https://}', '{링크:먼저|나중|https://example.com}']) {
    assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
  }
  assert.deepEqual(parseNoticeMarkup('{링크:{굵게:안내}|https://example.com}'),
    [paragraph([link('{굵게:안내}', 'https://example.com/')])]);
});

test('연속 목록은 묶고 문단 줄바꿈과 CRLF, 빈 줄을 구분한다', () => {
  const input = '첫 줄\r\n둘째 줄\r\n- 하나\r\n  - {굵게:둘}\r\n이어지는 글\r\n\r\n새 문단\r\n- 셋';
  assert.deepEqual(parseNoticeMarkup(input), [
    paragraph([text('첫 줄')], [text('둘째 줄')]),
    { type: 'list', items: [[text('하나')], [bold(text('둘'))]] },
    paragraph([text('이어지는 글')]), paragraph([text('새 문단')]),
    { type: 'list', items: [[text('셋')]] },
  ]);
});

test('HTML처럼 보이는 글자는 서식 안에서도 텍스트 노드로 남는다', () => {
  assert.deepEqual(parseNoticeMarkup('<b>태그</b> {굵게:<img src=x onerror=alert(1)>}'), [
    paragraph([text('<b>태그</b> '), bold(text('<img src=x onerror=alert(1)>'))]),
  ]);
});

test('이미지 확장자와 파일명, 설명 또는 제목 대체를 처리한다', () => {
  assert.deepEqual(parseNoticeMarkup(
    ' {이미지:poster-1_a.JPEG|{굵게:포스터} 설명} \n{이미지:b.webp}\n{이미지:c.GIF| }', '공지 제목',
  ), [localImage('poster-1_a.JPEG', '{굵게:포스터} 설명'), localImage('b.webp', '공지 제목'), localImage('c.GIF', '공지 제목')]);
  for (const file of ['a.png', 'b.jpg', 'c.WEBP', 'd.gif', 'x'.repeat(60) + '.png']) {
    assert.deepEqual(parseNoticeMarkup('{이미지:' + file + '}'), [localImage(file, '')]);
  }
});

test('경로, 공백, 잘못된 확장자, 61자 파일명과 문중 이미지 문법은 글자로 남는다', () => {
  const names = ['../a.png', 'a/b.png', 'a\\b.png', 'a..png',
    'my image.png', 'a.svg', 'x'.repeat(61) + '.png'];
  for (const file of names) {
    const plain = '{이미지:' + file + '|{굵게:설명}}';
    assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
  }
  for (const plain of ['본문 {이미지:a.png|설명}', '{이미지:a.png}{이미지:b.png}']) {
    assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
  }
});

test('이미지는 목록을 끊고 넷째 이미지 줄은 문단으로 남긴다', () => {
  const input = '- 앞\n{이미지:a.png}\n- 뒤\n{이미지:b.png}\n{이미지:c.png}\n{이미지:d.png|네 번째 포스터}';
  assert.deepEqual(parseNoticeMarkup(input), [
    { type: 'list', items: [[text('앞')]] }, localImage('a.png', ''),
    { type: 'list', items: [[text('뒤')]] }, localImage('b.png', ''), localImage('c.png', ''),
    paragraph([text('{이미지:d.png|네 번째 포스터}')]),
  ]);
});

test('이미지 한 줄만 적힌 공지도 시트의 유효한 공지다', () => {
  const notices = parseNotices([
    ['ID', '사용', '시작일', '제목', '내용'],
    ['only-image', 'TRUE', '2026-11-27', '새 포스터', '{이미지:a.png}'],
  ]);
  assert.equal(notices.length, 1);
  assert.deepEqual(parseNoticeMarkup(notices[0].content, notices[0].title), [localImage('a.png', '새 포스터')]);
});


test('여는 괄호 없이 남은 닫는 괄호는 글자로 둔다', () => {
  assert.deepEqual(parseNoticeMarkup('a}b\n{굵게:a}}'), [
    paragraph([text('a}b')], [bold(text('a')), text('}')]),
  ]);
});

test('내용 없는 목록 줄은 글 줄로 표시하고 앞뒤 목록을 나눈다', () => {
  assert.deepEqual(parseNoticeMarkup('- 앞\n- \n  -    \n-\n  - 뒤'), [
    { type: 'list', items: [[text('앞')]] },
    paragraph([text('- ')], [text('  -    ')], [text('-')]),
    { type: 'list', items: [[text('뒤')]] },
  ]);
});

test('확장자가 없는 HTTPS 이미지와 쿼리를 허용하고 대상의 앞뒤 공백을 제거한다', () => {
  const url = 'https://images.example.com/shared/preview';
  const query = url + '?key=demo%7Ctest&size=preview';
  const long = url + '/' + 'a'.repeat(1999 - url.length);
  assert.deepEqual(parseNoticeMarkup(
    `{이미지: ${url} | 첫째 }\n{이미지:${query}|둘째}\n{이미지:${long}}`,
  ), [image(url, '첫째'), image(query, '둘째'), image(long, '')]);
  assert.deepEqual(parseNoticeMarkup('{이미지: a.png | 안내 }'), [localImage('a.png', '안내')]);
});

test('비 HTTPS, 프로토콜 상대 주소, 잘못된 주소와 2001자 주소는 원문을 유지한다', () => {
  const prefix = 'https://example.com/';
  const tooLong = prefix + 'x'.repeat(2001 - prefix.length);
  for (const target of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,X',
    '//example.com/a.png', 'https://', tooLong]) {
    const plain = `{이미지:${target}|안내}`;
    assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
  }
});

test('10~100% 크기, 공백과 생략을 처리하며 비어 있는 설명은 제목을 쓴다', () => {
  assert.deepEqual(parseNoticeMarkup(
    '{이미지:a.png||40%}\n{이미지:a.png|10|10%}\n{이미지:a.png|60| 60% }', '공지 제목',
  ), [localImage('a.png', '공지 제목', 40), localImage('a.png', '10', 10), localImage('a.png', '60', 60)]);
  assert.deepEqual(parseNoticeMarkup('{이미지:a.png|명시|100%}\n{이미지:a.png|생략|}'),
    [localImage('a.png', '명시'), localImage('a.png', '생략')]);
});

test('허용 범위를 벗어난 크기와 네 조각 이미지 줄은 원문을 유지한다', () => {
  for (const size of ['9%', '101%', '60', '60px', 'abc', '-10%', '0%', '40.5%', '60%;color:red']) {
    const plain = `{이미지:a.png|설명|${size}}`;
    assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
  }
  const plain = '{이미지:a.png|포스터|40%|추가}';
  assert.deepEqual(parseNoticeMarkup(plain), [paragraph([text(plain)])]);
});
