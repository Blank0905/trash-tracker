// ================================================================
// 深色現代 SaaS Design Tokens（GitHub Dark / Vercel / Supabase 風）
// 全 React 後台共用；各頁面 `import { theme } from '../../utils/theme'`
// ================================================================

export const theme = {
  colors: {
    // 背景層次（從最深到最淺）
    bg:           '#0d1117',          // page background
    surface1:     '#161b22',          // 卡片 / sidebar
    surface2:     '#21262d',          // hover / elevated
    surface3:     '#2d333b',          // active / pressed

    // 邊框
    border:       '#30363d',
    borderStrong: '#444c56',

    // 文字（從亮到暗）
    text:         '#e6edf3',
    textDim:      '#9198a1',
    textMuted:    '#6e7681',
    textFaint:    '#484f58',

    // 品牌（LINE 綠）— 保留為主要動作色
    brand:        '#00B900',
    brandHover:   '#00d10a',
    brandActive:  '#009a00',
    brandSoft:    'rgba(0, 185, 0, 0.10)',
    brandTint:    'rgba(0, 185, 0, 0.25)',

    // 語義 accents
    blue:         '#58a6ff',          // info / link
    blueSoft:     'rgba(88, 166, 255, 0.12)',
    amber:        '#d29922',          // warning
    amberSoft:    'rgba(210, 153, 34, 0.12)',
    red:          '#f85149',          // danger
    redSoft:      'rgba(248, 81, 73, 0.12)',
    green:        '#3fb950',          // success（系統 OK 用，跟品牌綠區隔）
    greenSoft:    'rgba(63, 185, 80, 0.12)',
  },

  fonts: {
    // 系統字優先：iOS 用 SF Pro、Windows 用 Segoe UI、加 CJK fallback
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
    sm: '0 1px 2px rgba(0,0,0,0.4)',
    md: '0 4px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)',
    lg: '0 12px 32px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)',
    // 帶綠光的 primary button shadow
    brand: '0 0 0 1px rgba(0,185,0,0.12), 0 2px 6px rgba(0,185,0,0.18)',
  },

  transition: {
    fast: '0.12s ease',
    base: '0.18s ease',
  },
};
