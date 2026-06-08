import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

const UsersManage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [canDemoteAdmins, setCanDemoteAdmins] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();

      const res = await authedFetch(`${baseUrl}/api/users/list`);
      if (!res.ok) throw new Error('無法取得使用者管理清單');

      const data = await res.json();
      setUsers(data.users || []);
      setCanDemoteAdmins(data.can_demote_admins === true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePromote = async (userId, username) => {
    const confirmAction = window.confirm(`確定要將 [${username}] 提升為系統管理員 (Admin) 嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/users/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '提升失敗');

      alert(`成功！${username} 已正式晉升為系統管理員`);
      setUsers(prev => prev.map(u => (
        u.user_id === userId ? { ...u, role: 'admin' } : u
      )));
    } catch (err) {
      alert(`操作失敗：${err.message}`);
    }
  };

  const handleSuspend = async (userId, username) => {
    const confirmAction = window.confirm(`確定要將 [${username}] 停權嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/users/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '停權失敗');

      alert(`處分成功！${username} 已停權`);
      setUsers(prev => prev.map(u => (
        u.user_id === userId ? { ...u, status: 'suspended' } : u
      )));
    } catch (err) {
      alert(`操作失敗：${err.message}`);
    }
  };

  const handleDemote = async (userId, username) => {
    const confirmAction = window.confirm(`確定要將 [${username}] 從管理員降為一般用戶嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/users/demote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '降權失敗');

      alert(`成功！${username} 已降為一般用戶`);
      setUsers(prev => prev.map(u => (
        u.user_id === userId ? { ...u, role: 'user' } : u
      )));
    } catch (err) {
      alert(`操作失敗：${err.message}`);
    }
  };

  const handleUnsuspend = async (userId, username) => {
    const confirmAction = window.confirm(`確定要解除 [${username}] 的停權狀態嗎？`);
    if (!confirmAction) return;

    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/users/unsuspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '解除停權失敗');

      alert(`成功！${username} 已解除停權`);
      setUsers(prev => prev.map(u => (
        u.user_id === userId ? { ...u, status: 'active' } : u
      )));
    } catch (err) {
      alert(`操作失敗：${err.message}`);
    }
  };

  const filteredUsers = users.filter(u =>
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>使用者權限與帳號管理</h2>
          <p style={styles.subtitle}>調閱系統所有註冊用戶，進行權限管理與停權控制。</p>
        </div>
        <input
          type="text"
          placeholder="搜尋用戶名稱或 Email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div style={styles.loadingBox}>正在讀取使用者資料...</div>
      ) : error ? (
        <div style={styles.errorBox}>
          <h4>使用者 API 讀取失敗</h4>
          <p>{error}</p>
          <button onClick={fetchUsers} style={styles.retryBtn}>重新嘗試連線</button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={styles.noData}>查無任何匹配的使用者。</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>UID</th>
                <th style={styles.th}>用戶名稱</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>權限</th>
                <th style={styles.th}>帳號狀態</th>
                <th style={styles.th}>管理操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isDeveloper = user.role === 'developer';
                const isAdmin = user.role === 'admin';
                const isSuspended = user.status === 'suspended';
                const displayName = user.username || user.email || `UID ${user.user_id}`;
                const noPermissionForDeveloperRow = isDeveloper;

                return (
                  <tr key={user.user_id} style={styles.tr}>
                    <td style={styles.td}><code>{user.user_id}</code></td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{user.username || <span style={{ color: '#aaa', fontWeight: 'normal' }}>未填寫</span>}</td>
                    <td style={styles.td}>{user.email || <span style={{ color: '#aaa' }}>LINE 綁定用戶</span>}</td>
                    <td style={styles.td}>
                      {isDeveloper ? (
                        <span style={styles.developerBadge}>開發者</span>
                      ) : isAdmin ? (
                        <span style={styles.adminBadge}>系統管理員</span>
                      ) : (
                        <span style={styles.userBadge}>一般用戶</span>
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
                        {isDeveloper ? (
                          <span style={styles.lockText}>開發者帳號不可更改</span>
                        ) : isAdmin ? (
                          canDemoteAdmins ? (
                            <button
                              type="button"
                              onClick={() => handleDemote(user.user_id, displayName)}
                              style={styles.demoteBtn}
                            >
                              降為使用者
                            </button>
                          ) : (
                            <span style={styles.lockText}>已具備管理員權限</span>
                          )
                        ) : isSuspended ? (
                          <span style={styles.lockText}>停權中不可升權</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromote(user.user_id, displayName)}
                            style={styles.promoteBtn}
                          >
                            提升管理員
                          </button>
                        )}

                        {isDeveloper || isAdmin ? (
                          <button
                            type="button"
                            disabled
                            style={{
                              ...styles.suspendBtn,
                              ...styles.disabledBtn
                            }}
                            title={isDeveloper ? '不可變更 developer 帳號' : '管理員不可互相停權'}
                          >
                            違規停權
                          </button>
                        ) : isSuspended ? (
                          <button
                            type="button"
                            onClick={() => handleUnsuspend(user.user_id, displayName)}
                            style={styles.unsuspendBtn}
                          >
                            解除停權
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSuspend(user.user_id, displayName)}
                            style={styles.suspendBtn}
                          >
                            違規停權
                          </button>
                        )}
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
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '24px',
    fontFamily: theme.fonts.sans,
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
  },
  title: { margin: 0, color: c.text, fontSize: '18px', fontWeight: '600', letterSpacing: '-0.015em' },
  subtitle: { margin: '6px 0 0 0', color: c.textDim, fontSize: '13px', lineHeight: '1.55' },
  searchInput: {
    padding: '8px 12px', borderRadius: r.md,
    border: `1px solid ${c.border}`, backgroundColor: c.surface1,
    color: c.text, width: '260px', fontSize: '13px',
    outline: 'none', fontFamily: theme.fonts.sans,
    transition: 'border-color 0.15s ease',
  },
  loadingBox: { textAlign: 'center', padding: '40px 24px', color: c.textMuted, fontSize: '13px' },
  errorBox: {
    padding: '16px 20px', backgroundColor: c.redSoft, color: c.red,
    borderRadius: r.md, border: `1px solid rgba(220, 38, 38, 0.25)`, textAlign: 'center',
  },
  retryBtn: {
    marginTop: '10px', padding: '6px 16px', backgroundColor: c.red, color: 'white',
    border: 'none', borderRadius: r.sm, cursor: 'pointer', fontWeight: '600',
    fontSize: '13px', fontFamily: theme.fonts.sans,
  },
  noData: { padding: '40px 24px', textAlign: 'center', color: c.textMuted, fontSize: '13px' },
  tableWrapper: {
    overflowX: 'auto',
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    textAlign: 'left', fontSize: '13px',
  },
  th: {
    padding: '10px 16px',
    backgroundColor: c.surface2,
    color: c.textMuted,
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${c.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px',
    borderBottom: `1px solid ${c.border}`,
    color: c.text,
  },
  tr: { backgroundColor: c.surface1 },
  // 各種角色 badge：用 soft tint 系列（亮色乾淨感）
  adminBadge: {
    backgroundColor: c.brandSoft, color: c.brand,
    padding: '3px 9px', borderRadius: r.sm,
    fontSize: '11px', fontWeight: '600',
    border: `1px solid ${c.brandTint}`,
    letterSpacing: '0.01em',
  },
  developerBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.10)', color: '#7c3aed',
    padding: '3px 9px', borderRadius: r.sm,
    fontSize: '11px', fontWeight: '600',
    border: '1px solid rgba(124, 58, 237, 0.25)',
    letterSpacing: '0.01em',
  },
  userBadge: {
    backgroundColor: c.blueSoft, color: c.blue,
    padding: '3px 9px', borderRadius: r.sm,
    fontSize: '11px', fontWeight: '600',
    letterSpacing: '0.01em',
  },
  activeText: { color: c.green, fontWeight: '600', fontSize: '12.5px' },
  suspendedText: { color: c.red, fontWeight: '600', fontSize: '12.5px' },
  actionGroup: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  // 升權：success 綠
  promoteBtn: {
    backgroundColor: c.green, color: 'white', border: `1px solid ${c.green}`,
    padding: '5px 12px', borderRadius: r.sm,
    cursor: 'pointer', fontWeight: '600', fontSize: '12px',
    fontFamily: theme.fonts.sans, transition: 'background 0.15s ease',
  },
  // 降權：amber 警示
  demoteBtn: {
    backgroundColor: c.amber, color: 'white', border: `1px solid ${c.amber}`,
    padding: '5px 12px', borderRadius: r.sm,
    cursor: 'pointer', fontWeight: '600', fontSize: '12px',
    fontFamily: theme.fonts.sans,
  },
  // 停權：danger 紅
  suspendBtn: {
    backgroundColor: c.red, color: 'white', border: `1px solid ${c.red}`,
    padding: '5px 12px', borderRadius: r.sm,
    cursor: 'pointer', fontWeight: '600', fontSize: '12px',
    fontFamily: theme.fonts.sans,
  },
  // 解除停權：info 藍
  unsuspendBtn: {
    backgroundColor: c.blue, color: 'white', border: `1px solid ${c.blue}`,
    padding: '5px 12px', borderRadius: r.sm,
    cursor: 'pointer', fontWeight: '600', fontSize: '12px',
    fontFamily: theme.fonts.sans,
  },
  disabledBtn: {
    backgroundColor: c.surface3, color: c.textFaint,
    borderColor: c.borderStrong, cursor: 'not-allowed',
  },
  lockText: {
    fontSize: '12px', color: c.textMuted,
    fontStyle: 'italic', padding: '6px 0', width: '100px',
  },
};

export default UsersManage;
