import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHandler } from '../server/app.js';
import { runClaude } from '../server/classifier.js';
import { createTagStore, findUntagged } from '../server/tags.js';

async function scratch(t) {
  const directory = await mkdtemp(join(tmpdir(), 'lunch-server-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const seed = join(directory, 'seed.json');
  const file = join(directory, 'tags.json');
  await writeFile(seed, JSON.stringify({ version: 1, tags: { 국밥: ['warm_soup'] } }));
  return { directory, file, seed };
}

test('태그 시드 복사, 저장 후 빈 배열 구분, 기존 파일 보존과 임시 파일 정리', async (t) => {
  const { directory, file, seed } = await scratch(t);
  const store = await createTagStore(file, seed);
  assert.equal(await readFile(file, 'utf8'), await readFile(seed, 'utf8'));
  await store.merge({ 국밥: ['light'], 한식: [] });
  assert.deepEqual(await createTagStore(file, seed).then((existing) => existing.read()), {
    국밥: ['warm_soup'], 한식: [],
  });
  assert.deepEqual(findUntagged(['한식', '냉면'], await store.read()), ['냉면']);
  assert.deepEqual((await readdir(directory)).sort(), ['seed.json', 'tags.json']);
});

test('손상 태그 파일은 기동을 막고 실행 중에는 마지막 정상값과 상태를 반환한다', async (t) => {
  const { file, seed } = await scratch(t);
  await writeFile(file, '{');
  await assert.rejects(createTagStore(file, seed), SyntaxError);
  await writeFile(file, await readFile(seed));
  const errors = [];
  const store = await createTagStore(file, seed, { error: (error) => errors.push(error) });
  const handler = createHandler({
    config: { allowedOrigins: [], regions: {}, classifier: 'off' },
    tagStore: store,
  });
  const health = async () => {
    let body;
    await handler({ method: 'GET', url: '/health', headers: {} }, {
      setHeader() {}, writeHead(status) { assert.equal(status, 200); },
      end(value) { body = JSON.parse(value); },
    });
    return body;
  };
  await writeFile(file, '{');
  assert.deepEqual(await store.read(), { 국밥: ['warm_soup'] });
  assert.equal((await health()).tagsFileError, '태그 파일 JSON 형식 오류');
  await store.merge({ 냉면: ['cold'] });
  assert.equal(await readFile(file, 'utf8'), '{');
  assert.deepEqual(errors, ['태그 파일 JSON 형식 오류']);
  await writeFile(file, JSON.stringify({ version: 1, tags: { 한식: [] } }));
  assert.equal((await health()).tagsFileError, null);
  assert.deepEqual(await store.read(), { 한식: [] });
});

test('Claude CLI 도구 비활성화, 프롬프트 경계, 빈 작업 폴더, 시간 제한과 stdin 닫기', async () => {
  const prompt = '--프롬프트 예시';
  let cwd;
  let closed = false;
  let checkDirectory;
  const result = await runClaude(prompt, (executable, args, options, callback) => {
    assert.equal(executable, 'claude');
    assert.deepEqual(args.slice(-2), ['--', prompt]);
    assert.equal(args[args.indexOf('--tools') + 1], '');
    assert.equal(options.timeout, 120_000);
    cwd = options.cwd;
    checkDirectory = readdir(cwd).then((files) => {
      assert.deepEqual(files, []);
      assert.equal(closed, true);
    });
    checkDirectory.then(() => callback(null, '{"result":"{}"}'), callback);
    return { stdin: { end() { closed = true; } } };
  });
  assert.equal(result, '{}');
  await assert.rejects(readdir(cwd), { code: 'ENOENT' });
});
