// 深色現代 SaaS 風（GitHub Dark / Vercel-ish）。RWD 自適應手機/桌面。
import { theme } from '../utils/theme';

const c = theme.colors;
const r = theme.radius;
const t = theme.transition;

export const getStyles = (isMobile) => ({
  container: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    height: isMobile ? 'auto' : '100vh',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: c.bg,
    overflowX: 'hidden',
    fontFamily: theme.fonts.sans,
    color: c.text,
    fontFeatureSettings: '"cv11", "ss01"', // SF Pro 的數字微優化
    WebkitFontSmoothing: 'antialiased',
  },

  // ============ 側邊欄（左邊 sidebar） ============
  sidebar: {
    width: isMobile ? '100%' : '252px',
    backgroundColor: c.surface1,
    borderRight: isMobile ? 'none' : `1px solid ${c.border}`,
    borderBottom: isMobile ? `1px solid ${c.border}` : 'none',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },

  sidebarHeader: {
    padding: '20px 18px 18px',
    borderBottom: `1px solid ${c.border}`,
  },

  sidebarLogo: {
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    color: c.text,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },

  menuList: {
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    overflowY: 'auto',
  },

  // 一般選單項目（單層、可點）
  menuItem: {
    padding: '8px 12px',
    borderRadius: r.sm,
    cursor: 'pointer',
    transition: `background ${t.fast}, color ${t.fast}`,
    fontSize: '14px',
    color: c.textDim,
    fontWeight: '500',
    letterSpacing: '-0.005em',
    userSelect: 'none',
  },

  // 「展開區」標題（顯示資料表 collapsible header）
  menuItemHeader: {
    padding: '8px 12px',
    borderRadius: r.sm,
    cursor: 'pointer',
    fontSize: '11.5px',
    color: c.textMuted,
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    userSelect: 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // 亮色下純 surface2 hover 感不夠明顯，active 用 indigo soft + brand 文字
  menuActive: {
    backgroundColor: c.brandSoft,
    color: c.brand,
    fontWeight: '600',
  },

  submenuBox: {
    paddingLeft: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    marginTop: '2px',
    marginLeft: '12px',
    borderLeft: `1px solid ${c.border}`,
  },

  submenuItem: {
    padding: '6px 10px 6px 14px',
    borderRadius: r.sm,
    cursor: 'pointer',
    fontSize: '13px',
    color: c.textMuted,
    transition: `background ${t.fast}, color ${t.fast}`,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.01em',
    userSelect: 'none',
  },

  submenuActive: {
    color: c.brand,
    backgroundColor: c.brandSoft,
    fontWeight: '600',
  },

  sidebarFooter: {
    padding: '12px 16px',
    borderTop: `1px solid ${c.border}`,
  },

  connectionBox: {
    fontSize: '12px',
    color: c.textDim,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.02em',
  },

  // ============ 右側主內容 ============
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: c.bg,
  },

  topBar: {
    height: isMobile ? 'auto' : '56px',
    backgroundColor: c.surface1,
    borderBottom: `1px solid ${c.border}`,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    padding: isMobile ? '12px 18px' : '0 24px',
    gap: isMobile ? '8px' : '0',
    flexShrink: 0,
  },

  pageTitleText: {
    fontSize: '14px',
    fontWeight: '600',
    color: c.text,
    letterSpacing: '-0.005em',
  },

  userInfoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: isMobile ? '100%' : 'auto',
    justifyContent: isMobile ? 'space-between' : 'flex-end',
  },

  userLabel: {
    fontSize: '12.5px',
    color: c.textDim,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.01em',
  },

  // 登出按鈕：白底 + 細邊，文字微紅暗示「破壞性動作」但不過於搶眼
  logoutButton: {
    padding: '6px 12px',
    backgroundColor: c.surface1,
    border: `1px solid ${c.border}`,
    color: c.red,
    borderRadius: r.sm,
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '12.5px',
    transition: `background ${t.fast}, color ${t.fast}, border-color ${t.fast}`,
    fontFamily: theme.fonts.sans,
  },

  contentBody: {
    padding: isMobile ? '16px' : '24px',
    flex: 1,
    overflowY: 'auto',
  },

  // 空頁面 placeholder
  dummyPage: {
    backgroundColor: c.surface1,
    padding: isMobile ? '32px 20px' : '48px',
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    fontSize: '14px',
    fontWeight: '500',
    color: c.textDim,
    minHeight: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
});
