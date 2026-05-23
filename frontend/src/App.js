import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // 👈 匯入新做的互動主頁

function App() {
  // 初始化狀態：檢查瀏覽器快取裡有沒有 token，有的話就代表已經登入了
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('access_token')
  );

  // 登入成功的處理：切換狀態為 true
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  // 登出成功的處理：切換狀態為 false
  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <>
      {/* 條件渲染：如果通過驗證就秀 Dashboard，否則秀 Login */}
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;