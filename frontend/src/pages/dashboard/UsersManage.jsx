import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../../utils/api';

const UsersManage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 🔍 向實體後端 API 撈取真實資料庫的所有用戶清單
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();
      
      const res = await fetch(`${baseUrl}/api/users/list`);
      if (!res.ok) throw new Error('無法取得使用者管理清單');
      
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. 🔼 提升為管理員實體對接
  const handlePromote = async (userId, username) => {
    const confirmAction = window.confirm(`確定要將 [${username}] 提升為系統管理員 (Admin) 嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/users/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }) // 傳送資料庫 user_id 門牌
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '提升失敗');
      
      alert(`成功！${username} 已正式晉升為系統管理員 👑`);
      
      // 畫面同步更新狀態，免重新整理
      setUsers(users.map(u => u.user_id === userId ? { ...u, role: 'admin' } : u));
    } catch (err) {
      alert('操作失敗：' + err.message);
    }
  };

  // 3. 🚫 違規停權實體對接
  const handleSuspend = async (userId, username) => {
    const confirmAction = window.confirm(`危害專題安全！確定要將一般用戶 [${username}] 進行停權處置嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/users/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '停權失敗');
      
      alert(`處分成功！${username} 帳號已被強制停權 🚫`);
      
      // 畫面同步更新狀態
      setUsers(users.map(u => u.user_id === userId ? { ...u, status: 'suspended' } : u));
    } catch (err) {
      alert('操作失敗：' + err.message);
    }
  };

  // 關鍵字篩選過濾
  const filteredUsers = users.filter(u => 
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>👥 使用者權限與帳號管理</h2>
          <p style={styles.subtitle}>調閱系統所有註冊用戶，進行高階安全授權與違規停權調度。</p>
        </div>
        <input 
          type="text" 
          placeholder="🔍 搜尋用戶名稱或 Email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div style={styles.loadingBox}>⏳ 正在讀取實體 MySQL 使用者數據...</div>
      ) : error ? (
        <div style={styles.errorBox}>
          <h4>❌ 使用者 API 讀取失敗</h4>
          <p>{error}</p>
          <button onClick={fetchUsers} style={styles.retryBtn}>重新嘗試連線</button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={styles.noData}>查無任何匹配的使用者數據。</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>UID</th>
                <th style={styles.th}>用戶名稱</th>
                <th style={styles.th}>電子郵件 (Email)</th>
                <th style={styles.th}>當前權限 (Role)</th>
                <th style={styles.th}>帳號狀態</th>
                <th style={styles.th}>安全管理操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const isSuspended = user.status === 'suspended';

                return (
                  <tr key={user.user_id} style={styles.tr}>
                    <td style={styles.td}><code>{user.user_id}</code></td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{user.username || <span style={{color:'#aaa', fontWeight:'normal'}}>未填寫</span>}</td>
                    <td style={styles.td}>{user.email || <span style={{color:'#aaa'}}>LINE 一鍵綁定用戶</span>}</td>
                    <td style={styles.td}>
                      {isAdmin ? (
                        <span style={styles.adminBadge}>👑 系統管理員</span>
                      ) : (
                        <span style={styles.userBadge}>👤 一般用戶</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {isSuspended ? (
                        <span style={styles.suspendedText}>● 已停權</span>
                      ) : (
                        <span style={styles.activeText}>● 正常使用</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        {/* 提升為 Admin 按鈕 */}
                        {!isAdmin ? (
                          <button 
                            onClick={() => handlePromote(user.user_id, user.username || user.email)}
                            style={styles.promoteBtn}
                          >
                            🔼 提升管理員
                          </button>
                        ) : (
                          <span style={styles.lockText}>🔒 已具備高階權限</span>
                        )}

                        {/* 停權按鈕：💡 核心安全平權防禦！若為管理員則按鈕直接 disabled 反灰 🔒 */}
                        <button 
                          onClick={() => handleSuspend(user.user_id, user.username || user.email)}
                          disabled={isAdmin || isSuspended}
                          style={{
                            ...styles.suspendBtn,
                            ...(isAdmin ? styles.disabledBtn : {}),
                            ...(isSuspended ? styles.alreadySuspendedBtn : {})
                          }}
                          title={isAdmin ? "管理員之間不能互相停權對方！" : ""}
                        >
                          {isSuspended ? '❌ 已處分' : '🚫 違規停權'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    padding: '24px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px'
  },
  title: {
    margin: 0,
    color: '#1a237e',
    fontSize: '22px',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: '5px 0 0 0',
    color: '#64748b',
    fontSize: '14px',
  },
  searchInput: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    width: '280px',
    fontSize: '14px',
    outline: 'none',
  },
  loadingBox: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
  },
  errorBox: {
    padding: '20px',
    backgroundColor: '#fff5f5',
    color: '#e53e3e',
    borderRadius: '8px',
    border: '1px solid #fed7d7',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: '10px',
    padding: '6px 16px',
    backgroundColor: '#e53e3e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  noData: {
    padding: '30px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
  },
  th: {
    padding: '14px 16px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontWeight: '700',
    borderBottom: '2px solid #e2e8f0',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #edf2f7',
    color: '#334155',
  },
  tr: {
    backgroundColor: '#fff',
  },
  adminBadge: {
    backgroundColor: '#efebe9',
    color: '#5d4037',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    border: '1px solid #d7ccc8'
  },
  userBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  activeText: {
    color: '#16a34a',
    fontWeight: 'bold',
  },
  suspendedText: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  actionGroup: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  promoteBtn: {
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  suspendBtn: {
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  disabledBtn: {
    backgroundColor: '#cbd5e1',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  alreadySuspendedBtn: {
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    border: '1px solid #fca5a5',
    cursor: 'not-allowed',
  },
  lockText: {
    fontSize: '13px',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '6px 0',
    width: '100px'
  }
};

export default UsersManage;