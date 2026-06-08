// ================================================================
// 管理者後台 Design Tokens — 亮色辦公管理風（類 Linear / GitHub Light）
// 主色用 indigo（#4f46e5），與 LIFF 端的 LINE 綠完全區隔：
// 「管理者操作 = 藍紫色 / 使用者端 = LINE 綠」一眼分得出來在哪個產品線
// ================================================================

export const theme = {
  colors: {
    // 背景層次（亮色，從最淺到最深）
    bg:           '#fafafa',          // page background — 微帶灰的白
    surface1:     '#ffffff',          // 卡片 / sidebar
    surface2:     '#f3f4f6',          // hover / elevated
    surface3:     '#e5e7eb',          // active / pressed

    // 邊框
    border:       '#e5e7eb',
    borderStrong: '#d1d5db',

    // 文字（從深到淺）
    text:         '#111827',          // 主文字 — 近黑
    textDim:      '#4b5563',          // 副文字
    textMuted:    '#6b7280',          // 弱化文字
    textFaint:    '#9ca3af',          // 占位、提示

    // 品牌 — 用 indigo 而非 LINE 綠（區分管理者 vs 使用者端）
    brand:        '#4f46e5',          // indigo-600
    brandHover:   '#4338ca',          // indigo-700
    brandActive:  '#3730a3',          // indigo-800
    brandSoft:    'rgba(79, 70, 229, 0.08)',
    brandTint:    'rgba(79, 70, 229, 0.22)',

    // 語義 accents
    blue:         '#0969da',          // info / link
    blueSoft:     'rgba(9, 105, 218, 0.10)',
    amber:        '#d97706',          // warning
    amberSoft:    'rgba(217, 119, 6, 0.10)',
    red:          '#dc2626',          // danger
    redSoft:      'rgba(220, 38, 38, 0.08)',
    green:        '#16a34a',          // success（線上、同步成功）
    greenSoft:    'rgba(22, 163, 74, 0.10)',
  },

  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif',
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", "JetBrains Mono", Consolas, "Liberation Mono", monospace',
  },

  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '999px',
  },

  shadow: {
    // 亮色下陰影要更柔、更淡，太深會顯髒
    sm: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
    lg: '0 12px 32px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
    // 主按鈕用淡淡的 indigo 光暈，比純黑陰影有層次
    brand: '0 1px 2px rgba(79, 70, 229, 0.10), 0 2px 6px rgba(79, 70, 229, 0.18)',
  },

  transition: {
    fast: '0.12s ease',
    base: '0.18s ease',
  },
};
