import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { hashSources, sourceVersion } from '../scripts/version-hash.mjs';

test('로컬 CSS·모듈·상대 import는 모두 같은 버전을 사용한다', async () => {
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)=["']((?!https?:|\/\/)[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
    .map((m) => m[1]);
  assert.ok(refs.some((s) => s.startsWith('css/')), 'CSS 참조가 있어야 한다');
  assert.ok(refs.some((s) => s.startsWith('js/')), '앱 모듈 참조가 있어야 한다');
  for (const file of await readdir(new URL('js/', root))) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(`js/${file}`, root), 'utf8');
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g)) {
      refs.push(match[1]);
    }
  }
  const versions = refs.map((ref) => {
    assert.match(ref, /\?v=[a-f0-9]{12}$/, `버전 누락/형식 오류: ${ref}`);
    return ref.split('?v=')[1];
  });
  assert.equal(new Set(versions).size, 1, '모든 자원 버전이 같아야 한다');
  assert.equal(versions[0], await sourceVersion(root), '소스 내용이 바뀌었습니다. npm run bump를 실행하세요');
});

test('콘텐츠 해시는 LF/CRLF·기존 버전·입력 파일 순서에 영향받지 않음', () => {
  const first = [['js/a.js', "import './b.js?v=202611051333';\r\nconst a = 1;\r\n"],
    ['css/a.css', 'body { color: red; }\r\n']];
  const second = [['css/a.css', 'body { color: red; }\n'],
    ['js/a.js', "import './b.js?v=abcdef123456';\nconst a = 1;\n"]];
  assert.equal(hashSources(first), hashSources(second));
});

test('JS·CSS 내용이나 파일명이 바뀌면 콘텐츠 해시도 달라짐', () => {
  const entries = [['js/a.js', 'const a = 1;\n'], ['css/a.css', 'body {}\n']];
  const baseline = hashSources(entries);
  assert.match(baseline, /^[a-f0-9]{12}$/);
  assert.notEqual(baseline, hashSources([['js/a.js', 'const a = 2;\n'], entries[1]]));
  assert.notEqual(baseline, hashSources([entries[0], ['css/a.css', 'body {color:red}\n']]));
  assert.notEqual(baseline, hashSources([['js/b.js', entries[0][1]], entries[1]]));
});
