// 배포 전 로컬 CSS·모듈 참조에 같은 시각 버전을 붙인다.
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
const files = ['index.html', ...(await readdir(new URL('js/', root))).filter((s) => s.endsWith('.js')).map((s) => `js/${s}`)];
let changed = 0;
for (const file of files) {
  const url = new URL(file, root);
  const source = await readFile(url, 'utf8');
  const updated = file === 'index.html'
    ? source.replace(/((?:src|href)=["'])((?!https?:|\/\/)[^"'?]+\.(?:js|css))(?:\?[^"']*)?(["'])/g,
      (_match, prefix, address, quote) => `${prefix}${address}?v=${version}${quote}`)
    : source.replace(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])(\.{1,2}\/[^"'?]+)(?:\?[^"']*)?(["'])/g,
      (_match, prefix, address, quote) => `${prefix}${address}?v=${version}${quote}`);
  if (updated === source) continue;
  await writeFile(url, updated, 'utf8');
  changed += 1;
}
console.log(`버전 ${version}: ${changed}개 파일 변경`);
