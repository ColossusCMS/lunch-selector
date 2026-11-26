import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGuard, buildPickPrompt, validatePick, weatherKey } from '../server/recommender.js';

test('서울 날짜와 정렬된 날씨 분류가 캐시 키를 결정한다', () => {
  assert.equal(weatherKey(Date.parse('2026-11-26T14:59:59Z'), ['rain', 'cold']), '2026-11-26|cold+rain');
  assert.equal(weatherKey(Date.parse('2026-11-26T15:00:00Z'), []), '2026-11-27|mild');
});

test('프롬프트는 눈·서울 요일을 쓰고 null 지표와 긴 업종을 제외하며 가나다순 80개를 보낸다', () => {
  const valid = Array.from({ length: 85 }, (_, i) => '업종' + i).reverse();
  const prompt = buildPickPrompt({
    region: '검암', date: Date.parse('2026-11-26T15:00:00Z'),
    weather: { conditions: ['rain', 'cold'], badge: '❄️ 오늘 눈', apparentMin: null,
      apparentMax: null, precipitationProbabilityMax: 90 },
    categories: [...valid, '업종0 ', '', '면'.repeat(21)],
  });
  assert.match(prompt, /검암의 점심시간\(11~13시\) 날씨: 눈·추움, 강수확률 최대 90%/);
  assert.match(prompt, /2026-11-27 \(금요일\)/);
  assert.doesNotMatch(prompt, /null|체감|면{21}/);
  assert.deepEqual(JSON.parse(prompt.split('\n').at(-1).slice('업종: '.length)),
    valid.sort((a, b) => a.localeCompare(b, 'ko')).slice(0, 80));
});

test('AI 업종은 JSON 객체와 배열을 요구하고 허용 목록의 고유 업종 최대 6개를 남긴다', () => {
  const categories = ['국밥', '냉면', '백반', '쌀국수', '도시락', '만두', '초밥'];
  for (const output of ['오류', '[]', '{}', '{"categories":"국밥"}', '{"categories":["없음",4]}']) {
    assert.throws(() => validatePick(output, categories));
  }
  const output = JSON.stringify({
    categories: ['미등록', ' 국밥 ', 123, '국밥', ...categories],
    message: '  따끈한\u0085 국밥\n  먹자\u0000 ',
  });
  assert.deepEqual(validatePick('```json\n' + output + '\n```', categories),
    { categories: categories.slice(0, 6), message: '따끈한 국밥 먹자' });
});

test('빈 문구, 문자열 아닌 문구와 60 코드포인트 초과 문구는 업종만 유지한다', () => {
  for (const message of [' ', 42, '🍜'.repeat(61), null]) {
    assert.deepEqual(validatePick(JSON.stringify({ categories: ['국밥'], message }), ['국밥']),
      { categories: ['국밥'], message: null });
  }
  const message = '🍜'.repeat(60);
  assert.equal(validatePick(JSON.stringify({ categories: ['국밥'], message }), ['국밥']).message, message);
});

test('정반대 날씨 태그만 제외하고 안전장치 결과가 비면 실패한다', () => {
  const tags = { 냉면: ['cold'], 메밀: ['cold', 'light'], 국밥: ['warm_soup', 'greasy'], 백반: [] };
  const picked = { categories: ['냉면', '메밀', '국밥', '백반', '치킨'], message: null };
  for (const condition of ['rain', 'cold']) {
    assert.deepEqual(applyGuard(picked, [condition], tags).categories, ['메밀', '국밥', '백반', '치킨']);
  }
  assert.deepEqual(applyGuard(picked, ['hot'], tags).categories, ['냉면', '메밀', '백반', '치킨']);
  assert.deepEqual(applyGuard(picked, ['rain', 'hot'], tags).categories, ['메밀', '백반', '치킨']);
  assert.deepEqual(applyGuard(picked, [], tags), picked);
  assert.throws(() => applyGuard({ categories: ['냉면'] }, ['cold'], tags), /날씨에 맞는 추천 업종 없음/);
});

test('JSON 앞뒤 설명문을 허용하며 중괄호 없는 글과 잘못된 JSON은 거부한다', () => {
  const json = '{"categories":["국밥"]}';
  for (const output of ['여기 있어:\n' + json, '앞 설명\n' + json + '\n뒤 설명']) {
    assert.deepEqual(validatePick(output, ['국밥']), { categories: ['국밥'], message: null });
  }
  assert.throws(() => validatePick('중괄호 없는 글', ['국밥']), SyntaxError);
  assert.throws(() => validatePick('앞 설명 {잘못된 JSON} 뒤 설명', ['국밥']), SyntaxError);
});

test('제로폭·양방향 제어문자가 있는 문구는 공백으로 정리한다', () => {
  const output = JSON.stringify({ categories: ['국밥'], message: '따뜻한\u200B\u202E국밥\u2066 먹자' });
  assert.equal(validatePick(output, ['국밥']).message, '따뜻한 국밥 먹자');
});

test('같은 체감온도는 한 번 쓰고 업종 이름의 줄바꿈과 따옴표는 JSON 배열 안에 남긴다', () => {
  const category = '업종\n"]}';
  const prompt = buildPickPrompt({
    region: '검암', date: Date.parse('2026-11-26T00:00:00Z'),
    weather: { conditions: [], badge: '', apparentMin: 3, apparentMax: 3 },
    categories: [category],
  });
  assert.match(prompt, /무난, 체감 3℃\./);
  const lines = prompt.split('\n');
  assert.equal(lines.filter((line) => line.startsWith('업종: ')).length, 1);
  assert.equal(lines.at(-1), '업종: ' + JSON.stringify([category]));
});
