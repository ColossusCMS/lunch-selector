// 자원 버전 표기와 OS별 줄바꿈을 제외한 CSS·JS 내용으로 버전을 계산한다.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

export function hashSources(entries) {
  const hash = createHash('sha256');
  for (const [name, source] of [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const normalized = source.replace(/\r\n/g, '\n').replace(/\?v=[^"'`\s&)>]*/g, '');
    hash.update(JSON.stringify([name, normalized]) + '\n');
  }
  return hash.digest('hex').slice(0, 12);
}

export async function sourceVersion(root = new URL('../', import.meta.url)) {
  const entries = [];
  for (const [dir, extension] of [['css', '.css'], ['js', '.js']]) {
    for (const entry of await readdir(new URL(`${dir}/`, root), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
      const name = `${dir}/${entry.name}`;
      entries.push([name, await readFile(new URL(name, root), 'utf8')]);
    }
  }
  return hashSources(entries);
}
