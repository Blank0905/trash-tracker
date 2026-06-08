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
// 主色系：#94785A 暖棕（brand）/ #E0D9D3 米色（surface3 + border）/ #F6F5F3 奶白（bg）
// 整體走「公文 / 公報 / 自然」氣質：低彩度、暖灰調、紙感
const CSS = `
:root {
  /* 背景層次：F6F5F3 奶白底 → 白卡片 → 暖灰 hover → E0D9D3 active */
  --c-bg: #f6f5f3;
  --c-surface1: #ffffff;
  --c-surface2: #efeae4;
  --c-surface3: #e0d9d3;

  --c-border: #e0d9d3;
  --c-borderStrong: #c9bfb5;

  /* 文字也是暖色系，避免冷灰跟暖棕打架 */
  --c-text: #2a2520;
  --c-textDim: #5c4f44;
  --c-textMuted: #837567;
  --c-textFaint: #b5a99b;

  /* 品牌：#94785A 暖棕（土黃 / khaki / 黏土色） */
  --c-brand: #94785a;
  --c-brandHover: #7e6549;
  --c-brandActive: #685237;
  --c-brandSoft: rgba(148, 120, 90, 0.10);
  --c-brandTint: rgba(148, 120, 90, 0.28);

  /* Accent 也降彩度走暖調：避免螢光感破壞整體氛圍 */
  --c-blue: #3e6f8f;            /* 公文藍 */
  --c-blueSoft: rgba(62, 111, 143, 0.10);
  --c-amber: #b07a2a;           /* 焦糖琥珀 */
  --c-amberSoft: rgba(176, 122, 42, 0.10);
  --c-red: #b04848;             /* 磚紅 */
  --c-redSoft: rgba(176, 72, 72, 0.10);
  --c-green: #6f8554;           /* 苔綠 / 鼠尾草綠 */
  --c-greenSoft: rgba(111, 133, 84, 0.10);

  /* 陰影：用棕色而非藍色，跟暖底融合不會「藍藍髒髒」 */
  --sh-sm: 0 1px 2px rgba(74, 56, 36, 0.05), 0 1px 3px rgba(74, 56, 36, 0.06);
  --sh-md: 0 4px 12px rgba(74, 56, 36, 0.07), 0 1px 3px rgba(74, 56, 36, 0.05);
  --sh-lg: 0 12px 32px rgba(74, 56, 36, 0.10), 0 2px 6px rgba(74, 56, 36, 0.05);
  --sh-brand: 0 1px 2px rgba(148, 120, 90, 0.12), 0 2px 6px rgba(148, 120, 90, 0.22);

  color-scheme: light;
}

:root[data-theme="dark"] {
  /* 暗色版也維持暖系：木紋 / 咖啡漬 / 老紙的氛圍 */
  --c-bg: #1a1714;
  --c-surface1: #25201c;
  --c-surface2: #2f2925;
  --c-surface3: #3a332d;

  --c-border: #3a332d;
  --c-borderStrong: #4e453e;

  --c-text: #f0e9df;
  --c-textDim: #c7bdb1;
  --c-textMuted: #9d9388;
  --c-textFaint: #6e665c;

  /* 暖棕在暗底要亮 2 階（往沙色 / 杏仁色推）才看得清 */
  --c-brand: #c9a580;
  --c-brandHover: #d9b797;
  --c-brandActive: #e5c9ad;
  --c-brandSoft: rgba(201, 165, 128, 0.16);
  --c-brandTint: rgba(201, 165, 128, 0.36);

  --c-blue: #7ba8c9;
  --c-blueSoft: rgba(123, 168, 201, 0.14);
  --c-amber: #d4a65a;
  --c-amberSoft: rgba(212, 166, 90, 0.14);
  --c-red: #d88080;
  --c-redSoft: rgba(216, 128, 128, 0.14);
  --c-green: #98ac7b;
  --c-greenSoft: rgba(152, 172, 123, 0.14);

  --sh-sm: 0 1px 2px rgba(0, 0, 0, 0.32);
  --sh-md: 0 4px 14px rgba(0, 0, 0, 0.48), 0 1px 3px rgba(0, 0, 0, 0.32);
  --sh-lg: 0 16px 40px rgba(0, 0, 0, 0.58), 0 2px 6px rgba(0, 0, 0, 0.36);
  --sh-brand: 0 0 0 1px rgba(201, 165, 128, 0.38), 0 2px 12px rgba(201, 165, 128, 0.34);

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
