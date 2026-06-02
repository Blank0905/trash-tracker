import React, { useState, useEffect } from 'react';
// 💡 核心變更：引入改裝後的 getStyles 函式
import { getStyles } from './Dashboard.styles';

// 引入子資料表檔案
import TableAreas from './dashboard/TableAreas';
import TableBagRegulations from './dashboard/TableBagRegulations';
import TableFavorites from './dashboard/TableFavorites'; 
import TableNotifications from './dashboard/TableNotifications';
import TableRoutes from './dashboard/TableRoutes';
import TableStations from './dashboard/TableStations';
import TableStationSchedules from './dashboard/TableStationSchedules';
import TableUsers from './dashboard/TableUsers';
import UsersManage from './dashboard/UsersManage';
import ActionAddDelete from './dashboard/ActionAddDelete';
import RulesAnnouncements from './dashboard/RulesAnnouncements';
import { getBackendUrl } from '../utils/api';

const Dashboard = ({ onLogout }) => {
  const [activePage, setActivePage] = useState('welcome');
  const [dbConnected, setDbConnected] = useState(false);
  const [openDropdown, setOpenDropdown] = useState({ tables: true, actions: false });

  // 🟢 1. 即時監聽螢幕寬度 (RWD 核心)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🟢 2. 將即時狀態帶入，產出當前最適合該裝置的 styles 物件
  const styles = getStyles(isMobile);

  const adminEmail = localStorage.getItem('admin_email') || 'admin@trash.tracker.com';

  // 偵測後端連線狀態
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const baseUrl = await getBackendUrl();
        const response = await fetch(`${baseUrl}/api/db-status`);
        const data = await response.json();
        setDbConnected(data.connected);
      } catch (err) {
        setDbConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  // 頁面渲染調度中心
  const renderContent = () => {
    switch (activePage) {
      case 'welcome':
        return (
          <div style={styles.welcomeCard}>
            <h2>📊 歡迎使用垃圾車清運管理後台</h2>
            <p style={{ marginTop: '10px', color: '#666' }}>請點擊左側功能選單，開始進行資料庫調度和客製化管理。</p>
          </div>
        );
      
      case 'table-areas': return <TableAreas />;
      case 'table-bag_regulations': return <TableBagRegulations />;
      case 'table-favorites': return <TableFavorites />;
      case 'table-notifications': return <TableNotifications />;
      case 'table-routes': return <TableRoutes />;
      case 'table-stations': return <TableStations />;
      case 'table-station_schedules': return <TableStationSchedules />;
      case 'table-users': return <TableUsers />;
      
      case 'users-manage': return <UsersManage />;
      case 'action-add-delete': return <ActionAddDelete />;
      case 'rules-announcements': return <RulesAnnouncements />;
      
      default: return <div>頁面建構中...</div>;
    }
  };

  return (
    // 💡 這裡的結構完全恢復成原汁原味的乾淨程式碼！所有 RWD 判定都已被封裝進 styles 裡了
    <div style={styles.container}>
      {/* ─── 左側導覽列 Sidebar ─── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarLogo}>🗑️ Trash Tracker</span>
        </div>

        <div style={styles.menuList}>
          <div 
            onClick={() => setActivePage('welcome')} 
            style={{...styles.menuItem, ...(activePage === 'welcome' ? styles.menuActive : {})}}
          >
            🏠 後台首頁
          </div>

          <div>
            <div 
              onClick={() => setOpenDropdown({ ...openDropdown, tables: !openDropdown.tables })} 
              style={styles.menuItemHeader}
            >
              📁 1. 顯示資料表 {openDropdown.tables ? '▼' : '►'}
            </div>
            {openDropdown.tables && (
              <div style={styles.submenuBox}>
                {[
                  { id: 'areas', name: 'areas (區域)' },
                  { id: 'bag_regulations', name: 'bag_regulations' },
                  { id: 'favorites', name: 'favorites (收藏)' },
                  { id: 'notifications', name: 'notifications' },
                  { id: 'routes', name: 'routes (路線)' },
                  { id: 'stations', name: 'stations (站點)' },
                  { id: 'station_schedules', name: 'station_schedules' },
                  { id: 'users', name: 'users (用戶)' }
                ].map(table => (
                  <div 
                    key={table.id}
                    onClick={() => setActivePage(`table-${table.id}`)} 
                    style={{...styles.submenuItem, ...(activePage === `table-${table.id}` ? styles.submenuActive : {})}}
                  >
                    📄 {table.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div onClick={() => setActivePage('users-manage')} style={{...styles.menuItem, ...(activePage === 'users-manage' ? styles.menuActive : {})}}>👥 2. 管理使用者</div>
          <div onClick={() => setActivePage('action-add-delete')} style={{...styles.menuItem, ...(activePage === 'action-add-delete' ? styles.menuActive : {})}}>🚧 3. 新增與刪除面板</div>
          <div onClick={() => setActivePage('rules-announcements')} style={{...styles.menuItem, ...(activePage === 'rules-announcements' ? styles.menuActive : {})}}>📢 4. 規則與公告</div>
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.connectionBox}>
            <span style={{ color: dbConnected ? '#4caf50' : '#f44336', marginRight: '8px' }}>●</span>
            {dbConnected ? 'MySQL 已連線' : 'MySQL 斷線中'}
          </div>
        </div>
      </div>

      {/* ─── 右側主要內容區 ─── */}
      <div style={styles.mainWrapper}>
        <div style={styles.topBar}>
          <div style={styles.pageTitleText}>資料庫即時同步面板</div>
          <div style={styles.userInfoBox}>
            <span style={styles.userLabel}>管理員: {adminEmail}</span>
            <button onClick={() => { localStorage.clear(); onLogout(); }} style={styles.logoutButton}>安全登出</button>
          </div>
        </div>

        <div style={styles.contentBody}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;