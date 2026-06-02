// 📦 升級版：動態樣式大倉庫，完美支援 RWD 手機版自適應
export const getStyles = (isMobile) => ({
  container: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row', // 🟢 手機直排，電腦橫排
    height: isMobile ? 'auto' : '100vh',        // 🟢 手機隨內容伸展，電腦鎖定單一視窗
    width: '100vw',
    backgroundColor: '#f8f9fa',
    overflowX: 'hidden',                        // 🟢 徹底鎖死橫向捲軸，防止手機左右搖晃跑偏
    fontFamily: '"PingFang TC", "Helvetica Neue", Arial, sans-serif',
  },

  // 側邊欄整體樣式
  sidebar: {
    width: isMobile ? '100%' : '260px',         // 🟢 手機版撐滿全螢幕寬度，電腦版固定 260px
    backgroundColor: '#1a237e',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isMobile ? '0 4px 10px rgba(0,0,0,0.1)' : '4px 0 10px rgba(0,0,0,0.1)',
  },

  sidebarHeader: {
    padding: '25px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },

  sidebarLogo: {
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },

  menuList: {
    padding: '20px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflowY: 'auto',
  },

  menuItem: {
    padding: '12px 15px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '15px',
    color: '#c5cae9',
    fontWeight: '500',
  },

  menuItemHeader: {
    padding: '12px 15px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    color: '#ffffff',
    fontWeight: 'bold',
  },

  menuActive: {
    backgroundColor: '#303f9f',
    color: '#ffffff',
    fontWeight: 'bold',
  },

  submenuBox: {
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '4px',
    borderLeft: '2px solid rgba(255,255,255,0.2)',
    marginLeft: '20px',
  },

  submenuItem: {
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#b0bec5',
    transition: 'all 0.1s',
  },

  submenuActive: {
    color: '#00e676',
    fontWeight: 'bold',
  },

  sidebarFooter: {
    padding: '20px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: '#121858',
  },

  connectionBox: {
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
  },

  // 右半邊主內容區包裝層
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
  },

  topBar: {
    height: isMobile ? 'auto' : '70px',          // 🟢 手機版自動伸展，電腦版固定 70px
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row', // 🟢 手機版標題與管理員資訊改為上下排，電腦橫排
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    padding: isMobile ? '15px 20px' : '0 30px',
    gap: isMobile ? '10px' : '0',
  },

  pageTitleText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333333',
  },

  userInfoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    width: isMobile ? '100%' : 'auto',
    justifyContent: isMobile ? 'space-between' : 'flex-end', // 🟢 手機版登出按鈕自動推至最右邊
  },

  userLabel: {
    fontSize: '14px',
    color: '#666666',
  },

  logoutButton: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    border: '1px solid #d32f2f',
    color: '#d32f2f',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },

  contentBody: {
    padding: isMobile ? '15px' : '30px',        // 🟢 手機版間距縮小，把大空間留給 MySQL 數據表
    flex: 1,
    overflowY: 'auto',
  },

  welcomeCard: {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },

  dummyPage: {
    backgroundColor: '#ffffff',
    padding: isMobile ? '30px 15px' : '50px',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a237e',
    minHeight: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed #1a237e',
    textAlign: 'center',
  },
});