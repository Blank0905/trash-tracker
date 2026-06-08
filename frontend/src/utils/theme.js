// ================================================================
// 管理者後台 Design Tokens
// 主色用 indigo（與 LIFF 端的 LINE 綠完全區隔）。
// colors.* 都是 CSS 變數字串 — 切換 <html data-theme="dark"> 就整站變色。
// 所有頁面的 const c = theme.colors; 不用改、不用重 render。
// ================================================================

const STORAGE_KEY = 'admin_theme';
const ATTR = 'data-theme';

// 把 colors 物件做成 var(--c-XXX) 字串 map。實際顏色值在下面的 CSS 變數定義裡。
const cssVar = (name) => `var(--c-${name})`;

const COLOR_KEYS = [
  'bg', 'surface1', 'surface2', 'surface3',
  'border', 'borderStrong',
  'text', 'textDim', 'textMuted', 'textFaint',
  'brand', 'brandHover', 'brandActive', 'brandSoft', 'brandTint',
  'blue', 'blueSoft',
  'amber', 'amberSoft',
  'red', 'redSoft',
  'green', 'greenSoft',
];

const colors = COLOR_KEYS.reduce((m, k) => (m[k] = cssVar(k), m), {});

export const theme = {
  colors,

  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", "JetBrains Mono", Consolas, "Liberation Mono", monospace',
  },

  radius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '999px' },

  shadow: {
    sm: 'var(--sh-sm)',
    md: 'var(--sh-md)',
    lg: 'var(--sh-lg)',
    brand: 'var(--sh-brand)',
  },

  transition: { fast: '0.12s ease', base: '0.18s ease' },
};

// ---- CSS 變數定義（亮 / 暗）-------------------------------------
const CSS = `
:root {
  --c-bg: #fafafa;
  --c-surface1: #ffffff;
  --c-surface2: #f3f4f6;
  --c-surface3: #e5e7eb;

  --c-border: #e5e7eb;
  --c-borderStrong: #d1d5db;

  --c-text: #111827;
  --c-textDim: #4b5563;
  --c-textMuted: #6b7280;
  --c-textFaint: #9ca3af;

  --c-brand: #4f46e5;
  --c-brandHover: #4338ca;
  --c-brandActive: #3730a3;
  --c-brandSoft: rgba(79, 70, 229, 0.08);
  --c-brandTint: rgba(79, 70, 229, 0.22);

  --c-blue: #0969da;
  --c-blueSoft: rgba(9, 105, 218, 0.10);
  --c-amber: #d97706;
  --c-amberSoft: rgba(217, 119, 6, 0.10);
  --c-red: #dc2626;
  --c-redSoft: rgba(220, 38, 38, 0.08);
  --c-green: #16a34a;
  --c-greenSoft: rgba(22, 163, 74, 0.10);

  --sh-sm: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
  --sh-md: 0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);
  --sh-lg: 0 12px 32px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04);
  --sh-brand: 0 1px 2px rgba(79, 70, 229, 0.10), 0 2px 6px rgba(79, 70, 229, 0.18);

  color-scheme: light;
}

:root[data-theme="dark"] {
  /* 背景：類 GitHub Dark / Vercel */
  --c-bg: #0d1117;
  --c-surface1: #161b22;
  --c-surface2: #21262d;
  --c-surface3: #30363d;

  --c-border: #30363d;
  --c-borderStrong: #484f58;

  --c-text: #e6edf3;
  --c-textDim: #c9d1d9;
  --c-textMuted: #8b949e;
  --c-textFaint: #6e7681;

  /* indigo 在暗底要亮一階才看得清 */
  --c-brand: #818cf8;
  --c-brandHover: #a5b4fc;
  --c-brandActive: #c7d2fe;
  --c-brandSoft: rgba(129, 140, 248, 0.14);
  --c-brandTint: rgba(129, 140, 248, 0.32);

  --c-blue: #58a6ff;
  --c-blueSoft: rgba(88, 166, 255, 0.14);
  --c-amber: #f59e0b;
  --c-amberSoft: rgba(245, 158, 11, 0.14);
  --c-red: #f87171;
  --c-redSoft: rgba(248, 113, 113, 0.14);
  --c-green: #4ade80;
  --c-greenSoft: rgba(74, 222, 128, 0.14);

  /* 暗底下原本的鐵青陰影幾乎看不見，改成更深 + 一點點亮邊取代立體感 */
  --sh-sm: 0 1px 2px rgba(0, 0, 0, 0.30);
  --sh-md: 0 4px 14px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.30);
  --sh-lg: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
  --sh-brand: 0 0 0 1px rgba(129, 140, 248, 0.35), 0 2px 12px rgba(129, 140, 248, 0.35);

  color-scheme: dark;
}

/* page 整體底色跟著變數走，避免 React mount 前那一閃 */
html, body { background-color: var(--c-bg); }
`;

// ---- runtime helpers --------------------------------------------
function _injectStylesOnce() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('admin-theme-vars')) return;
  const el = document.createElement('style');
  el.id = 'admin-theme-vars';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function getThemeMode() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute(ATTR) === 'dark' ? 'dark' : 'light';
}

export function setThemeMode(mode) {
  if (typeof document === 'undefined') return;
  const next = mode === 'dark' ? 'dark' : 'light';
  if (next === 'dark') document.documentElement.setAttribute(ATTR, 'dark');
  else document.documentElement.removeAttribute(ATTR);
  try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
}

export function toggleThemeMode() {
  setThemeMode(getThemeMode() === 'dark' ? 'light' : 'dark');
}

// 在模組載入時就套用（避免登入頁先閃白）
(function _bootstrap() {
  if (typeof document === 'undefined') return;
  _injectStylesOnce();
  let saved = 'light';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'light'; } catch (_) {}
  setThemeMode(saved);
})();
