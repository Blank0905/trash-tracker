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
import TableAnnouncements from './dashboard/TableAnnouncements';
import TableApiSyncLog from './dashboard/TableApiSyncLog';
import TableBulkyWasteInfo from './dashboard/TableBulkyWasteInfo';
import TableEtlSources from './dashboard/TableEtlSources';
import UsersManage from './dashboard/UsersManage';
import ActionAddDelete from './dashboard/ActionAddDelete';
import RulesAnnouncements from './dashboard/RulesAnnouncements';
import EtlSources from './dashboard/EtlSources';
import SyncLog from './dashboard/SyncLog';
import HomeOverview from './dashboard/HomeOverview';
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
        return <HomeOverview dbConnected={dbConnected} onNavigate={setActivePage} />;
      
      case 'table-areas': return <TableAreas />;
      case 'table-bag_regulations': return <TableBagRegulations />;
      case 'table-favorites': return <TableFavorites />;
      case 'table-notifications': return <TableNotifications />;
      case 'table-routes': return <TableRoutes />;
      case 'table-stations': return <TableStations />;
      case 'table-station_schedules': return <TableStationSchedules />;
      case 'table-users': return <TableUsers />;
      case 'table-announcements': return <TableAnnouncements />;
      case 'table-api_sync_log': return <TableApiSyncLog />;
      case 'table-bulky_waste_info': return <TableBulkyWasteInfo />;
      case 'table-etl_sources': return <TableEtlSources />;

      case 'users-manage': return <UsersManage />;
      case 'action-add-delete': return <ActionAddDelete />;
      case 'rules-announcements': return <RulesAnnouncements />;
      case 'etl-sources': return <EtlSources />;
      case 'sync-log': return <SyncLog />;

      default: return <div>頁面建構中...</div>;
    }
  };

  return (
    // 💡 這裡的結構完全恢復成原汁原味的乾淨程式碼！所有 RWD 判定都已被封裝進 styles 裡了
    <div style={styles.container}>
      {/* ─── 左側導覽列 Sidebar ─── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader} onClick={() => setActivePage('welcome')}>
          <span style={{ ...styles.sidebarLogo, cursor: 'pointer' }} title="回首頁">🗑️ Trash Tracker</span>
        </div>

        <div style={styles.menuList}>
          <div>
            <div 
              onClick={() => setOpenDropdown({ ...openDropdown, tables: !openDropdown.tables })} 
              style={styles.menuItemHeader}
            >
              📁 顯示資料表 {openDropdown.tables ? '▼' : '►'}
            </div>
            {openDropdown.tables && (
              <div style={styles.submenuBox}>
                {[
                  'announcements', 'api_sync_log', 'areas', 'bag_regulations',
                  'bulky_waste_info', 'etl_sources', 'favorites', 'notifications',
                  'routes', 'stations', 'station_schedules', 'users'
                ].map(tid => (
                  <div
                    key={tid}
                    onClick={() => setActivePage(`table-${tid}`)}
                    style={{...styles.submenuItem, ...(activePage === `table-${tid}` ? styles.submenuActive : {})}}
                  >
                    📄 {tid}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div onClick={() => setActivePage('users-manage')} style={{...styles.menuItem, ...(activePage === 'users-manage' ? styles.menuActive : {})}}>👥 管理使用者</div>
          <div onClick={() => setActivePage('action-add-delete')} style={{...styles.menuItem, ...(activePage === 'action-add-delete' ? styles.menuActive : {})}}>🚧 新增與刪除面板</div>
          <div onClick={() => setActivePage('rules-announcements')} style={{...styles.menuItem, ...(activePage === 'rules-announcements' ? styles.menuActive : {})}}>📢 規則與公告</div>
          <div onClick={() => setActivePage('etl-sources')} style={{...styles.menuItem, ...(activePage === 'etl-sources' ? styles.menuActive : {})}}>🔗 ETL 來源設定</div>
          <div onClick={() => setActivePage('sync-log')} style={{...styles.menuItem, ...(activePage === 'sync-log' ? styles.menuActive : {})}}>🔄 API 同步紀錄</div>
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