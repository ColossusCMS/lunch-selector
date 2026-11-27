const ID = /^[A-Za-z0-9-]{1,40}$/;
const seoulDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
const ENABLED = new Set(['TRUE', 'O', 'Y']);

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function todayInSeoul(now = Date.now()) {
  return seoulDate.format(now);
}

export function httpsLink(value) {
  if (!value.startsWith('https://')) return '';
  try {
    return new URL(value).href;
  } catch {
    return '';
  }
}

export function parseNotices(rows) {
  const headers = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const columns = Object.fromEntries(['id', '사용', '시작일', '종료일', '제목', '내용', '버튼', '링크']
    .map((label) => [label, headers.indexOf(label)]));
  if (['id', '사용', '시작일', '제목', '내용'].some((label) => columns[label] < 0)) return [];
  const byId = new Map();
  for (let i = 1; i < rows.length; i += 1) {
    const cell = (label) => rows[i][columns[label]]?.trim() ?? '';
    const id = cell('id');
    if (!ID.test(id)) continue;
    byId.delete(id);
    if (!ENABLED.has(cell('사용').toUpperCase())) continue;
    const start = cell('시작일'), end = cell('종료일'), title = cell('제목'), content = cell('내용');
    if (!validDate(start) || (end && (!validDate(end) || end < start)) || !title || !content) continue;
    const link = httpsLink(cell('링크'));
    byId.set(id, {
      id, enabled: true, start, end, title, content, row: i + 1,
      link, button: link ? cell('버튼') || '자세히 보기' : '',
    });
  }
  return [...byId.values()];
}

export function activeNotices(notices, today, hidden, { limit = 3 } = {}) {
  return notices.filter(({ id, enabled, start, end }) => enabled && start <= today
    && (!end || today <= end) && hidden[id] !== 'forever' && hidden[id] !== today)
    .sort((a, b) => b.start.localeCompare(a.start) || b.row - a.row)
    .slice(0, limit);
}

export function readHidden(raw, today) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, value]) =>
      ID.test(id) && (value === 'forever' || (value === today && validDate(value)))));
  } catch {
    return {};
  }
}

export function hideNotice(hidden, id, kind, today) {
  return { ...hidden, [id]: kind === 'forever' ? 'forever' : today };
}
