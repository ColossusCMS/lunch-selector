// 화면 테마: 시스템 설정을 따르거나 라이트·다크로 고정한다.
// 깜빡임을 막으려고 index.html <head>의 인라인 스크립트가 같은 키로 먼저 적용한다.

export const THEME_KEY = 'lunch-selector:theme';

export const THEMES = [
  { id: 'system', icon: '🖥️', label: '시스템 설정' },
  { id: 'light', icon: '☀️', label: '라이트' },
  { id: 'dark', icon: '🌙', label: '다크' },
];

/**
 * @param {string | null | undefined} value 저장된 값
 * @returns {'system' | 'light' | 'dark'}
 */
export function parseTheme(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * 'system'이면 data-theme을 지워 CSS의 prefers-color-scheme을 따르게 한다.
 * @param {'system' | 'light' | 'dark'} theme
 */
export function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
