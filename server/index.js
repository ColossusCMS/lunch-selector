import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createApp } from './app.js';
import { createTagStore } from './tags.js';

const serverDir = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ options: { config: { type: 'string' } } });
const configPath = resolve(values.config ?? resolve(serverDir, 'config.json'));
const config = JSON.parse(await readFile(configPath, 'utf8'));

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535
  || !Array.isArray(config.allowedOrigins) || !config.allowedOrigins.every((origin) => typeof origin === 'string')
  || !config.regions || typeof config.regions !== 'object' || Array.isArray(config.regions)
  || !Object.values(config.regions).every((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
  || !Array.isArray(config.lunchHours) || !config.lunchHours.length
  || !config.lunchHours.every((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
  || !['claude', 'off'].includes(config.classifier)
  || (config.recommender !== undefined && !['claude', 'off'].includes(config.recommender))
  || !/^https?:\/\//.test(config.sheetCsvUrl ?? '')
  || (config.tagsFile !== undefined && (typeof config.tagsFile !== 'string' || !config.tagsFile))) {
  throw new Error('추천 서버 설정 형식 오류');
}

const defaultTags = resolve(serverDir, 'data/category-tags.json');
const tagsFile = config.tagsFile === undefined
  ? defaultTags : resolve(dirname(configPath), config.tagsFile);
const tagStore = await createTagStore(tagsFile, process.env.LUNCH_RECOMMEND_SEED ?? defaultTags);

const { handler, warmUp } = createApp({ config, tagStore });
createServer(handler).listen(config.port, () => {
  console.log(`점심 추천 서버 포트: ${config.port}`);
  warmUp();
});
