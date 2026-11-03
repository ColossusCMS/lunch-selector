import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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
    assert.match(ref, /\?v=\d{12}$/, `버전 누락/형식 오류: ${ref}`);
    return ref.split('?v=')[1];
  });
  assert.equal(new Set(versions).size, 1, '모든 자원 버전이 같아야 한다');
});
