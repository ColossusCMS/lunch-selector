import { httpsLink } from './notice.js?v=a3cfd24a9250';

const KINDS = new Map([
  ['굵게', { type: 'style', tag: 'strong', className: 'notice-bold' }],
  ['기울임', { type: 'style', tag: 'em', className: 'notice-italic'}],
  ['크게', { type: 'style', tag: 'span', className: 'notice-font-large' }],
  ['작게', { type: 'style', tag: 'span', className: 'notice-font-small' }],
  ['빨강', { type: 'style', tag: 'span', className: 'notice-color-red' }],
  ['파랑', { type: 'style', tag: 'span', className: 'notice-color-blue' }],
  ['초록', { type: 'style', tag: 'span', className: 'notice-color-green' }],
  ['주황', { type: 'style', tag: 'span', className: 'notice-color-orange' }],
  ['링크', { type: 'link' }],
  ['이미지', { type: 'image' }],
]);
const MAX_STYLE_DEPTH = 4;
const MAX_IMAGES = 3;
const MAX_IMAGE_URL_LENGTH = 2000;
const IMAGE_PERCENT = /^\d{1,3}%$/;
const IMAGE_FILE = /^[A-Za-z0-9_-]{1,60}\.(png|jpe?g|webp|gif)$/i;

function pairBraces(line) {
  const openings = [];
  const pairs = new Map();
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '{') openings.push(index);
    if (line[index] === '}' && openings.length) pairs.set(openings.pop(), index);
  }
  return pairs;
}

function splitLabel(value) {
  const separator = value.indexOf('|');
  return separator < 0 ? [value.trim(), '']
    : [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
}

function parseInline(line, pairs, start = 0, end = line.length, depth = 0) {
  const nodes = [];
  const opening = /\{([^{}:]+):/gy;
  let textStart = start;
  for (let index = start; index < end; index += 1) {
    if (line[index] !== '{') continue;
    opening.lastIndex = index;
    const match = opening.exec(line);
    const kind = KINDS.get(match?.[1]);
    const close = pairs.get(index);
    if (!kind || close === undefined || close >= end) continue;
    const innerStart = opening.lastIndex;
    const value = line.slice(innerStart, close);
    let node;
    if (kind.type === 'style' && depth < MAX_STYLE_DEPTH && value.trim()) {
      node = {
        ...kind, children: parseInline(line, pairs, innerStart, close, depth + 1),
      };
    } else if (kind.type === 'link') {
      const [text, address] = splitLabel(value);
      const href = httpsLink(address);
      if (text && href) node = { type: 'link', text, href };
    }

    if (node) {
      if (textStart < index) nodes.push({ type: 'text', value: line.slice(textStart, index) });
      nodes.push(node);
      textStart = close + 1;
    }
    index = close;
  }
  if (textStart < end) nodes.push({ type: 'text', value: line.slice(textStart, end) });
  return nodes;
}

function parseImage(line, pairs, title) {
  const trimmed = line.trim();
  const start = line.length - line.trimStart().length;
  const match = /^\{([^{}:]+):/.exec(trimmed);
  if (KINDS.get(match?.[1])?.type !== 'image'
    || pairs.get(start) !== start + trimmed.length - 1) return null;
  const parts = trimmed.slice(match[0].length, -1).split('|');
  if (parts.length > 3) return null;
  const [target, alt = '', size = ''] = parts.map((part) => part.trim());
  const src = IMAGE_FILE.test(target)
    ? `images/notice/${target}`
    : target.length <= MAX_IMAGE_URL_LENGTH ? httpsLink(target) : '';
  if (!src || (size && !IMAGE_PERCENT.test(size))) return null;

  const width = size ? Number.parseInt(size, 10) : 100;
  if (width < 10 || width > 100) return null;
  return { type: 'image', src, alt: alt || title, width };
}

export function parseNoticeMarkup(text, title = '') {
  const blocks = [];
  let current;
  let images = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      current = null;
      continue;
    }
    const pairs = pairBraces(line);
    const image = images < MAX_IMAGES ? parseImage(line, pairs, title) : null;
    if (image) {
      blocks.push(image);
      images += 1;
      current = null;
      continue;
    }

    const bullet = /^\s*- (?=\s*\S)/.exec(line);
    const type = bullet ? 'list' : 'paragraph';
    if (current?.type !== type) {
      current = bullet ? { type, items: [] } : { type, lines: [] };
      blocks.push(current);
    }
    const lines = bullet ? current.items : current.lines;
    lines.push(parseInline(line, pairs, bullet?.[0].length ?? 0));
  }
  return blocks;
}
