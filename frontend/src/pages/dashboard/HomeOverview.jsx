import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';

// 後台首頁：統計總覽。筆數卡可點 → 跳該資料表；最近同步卡可點 → 跳同步紀錄。
// 資料皆用通用瀏覽端點 /api/db/browse（limit=1 只為取 total），零後端改動。
const COUNT_CARDS = [
  { id: 'users', label: '使用者', icon: '👤' },
  { id: 'stations', label: '站點', icon: '📍' },
  { id: 'routes', label: '路線', icon: '🛣️' },
  { id: 'station_schedules', label: '清運班表', icon: '🗓️' },
  { id: 'favorites', label: '收藏', icon: '⭐' },
  { id: 'notifications', label: '通知', icon: '🔔' },
];

const STATUS_META = {
  success: { label: '成功', color: '#16a34a', icon: '✅' },
  failed:  { label: '失敗', color: '#dc2626', icon: '❌' },
  partial: { label: '部分', color: '#d97706', icon: '⚠️' },
};

const HomeOverview = ({ dbConnected, onNavigate }) => {
  const [counts, setCounts] = useState({});
  const [sync, setSync] = useState(null);   // { finishedAt, success, failed, partial } 或 null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const baseUrl = await getBackendUrl();

        const browseTotal = async (table) => {
          const res = await authedFetch(`${baseUrl}/api/db/browse?table=${table}&page=1&limit=1&sort=DESC&search=`);
          if (!res.ok) return null;
          return (await res.json()).total ?? null;
        };

        // 各表筆數（並行）
        const entries = await Promise.all(
          COUNT_CARDS.map(async c => [c.id, await browseTotal(c.id)])
        );

        // 最近一次同步：取最新 50 筆 → 鎖定最新 run_id → 統計該 run 的狀態
        let syncSummary = null;
        const res = await authedFetch(`${baseUrl}/api/db/browse?table=api_sync_log&page=1&limit=50&sort=DESC&search=`);
        if (res.ok) {
          const rows = (await res.json()).data || [];
          if (rows.length) {
            const latestRun = rows[0].run_id;
            const runRows = rows.filter(r => r.run_id === latestRun);
            syncSummary = {
              finishedAt: rows[0].finished_at,
              success: runRows.filter(r => r.status === 'success').length,
              failed: runRows.filter(r => r.status === 'failed').length,
              partial: runRows.filter(r => r.status === 'partial').length,
            };
          }
        }

        if (!alive) return;
        setCounts(Object.fromEntries(entries));
        setSync(syncSummary);
      } catch {
        /* 靜默：卡片顯示 — */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 19) : '—');
  const num = (v) => (v == null ? '—' : Number(v).toLocaleString());

  // 同步整體狀態：有失敗→失敗；有部分→部分；其餘→成功
  const overall = !sync ? null
    : sync.failed > 0 ? 'failed'
    : sync.partial > 0 ? 'partial'
    : 'success';
  const meta = overall ? STATUS_META[overall] : null;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📊 垃圾車清運管理後台</h2>
          <p style={styles.subtitle}>整體資料概況；點任一卡片可直接前往對應頁面。</p>
        </div>
        <span style={{ ...styles.dbPill, backgroundColor: dbConnected ? '#dcfce7' : '#fee2e2', color: dbConnected ? '#16a34a' : '#dc2626' }}>
          ● MySQL {dbConnected ? '已連線' : '斷線中'}
        </span>
      </div>

      {/* 筆數卡片 */}
      <div style={styles.grid}>
        {COUNT_CARDS.map(c => (
          <div key={c.id} style={styles.statCard} onClick={() => onNavigate(`table-${c.id}`)} title={`前往 ${c.id}`}>
            <span style={styles.statIcon}>{c.icon}</span>
            <span style={styles.statNum}>{loading ? '…' : num(counts[c.id])}</span>
            <span style={styles.statLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* 最近同步 */}
      <div style={styles.syncCard} onClick={() => onNavigate('sync-log')} title="前往 API 同步紀錄">
        <div style={styles.syncHead}>
          <span style={styles.syncTitle}>🔄 最近一次資料同步</span>
          <span style={styles.syncLink}>查看全部 ›</span>
        </div>
        {loading ? (
          <div style={styles.syncBody}>載入中…</div>
        ) : !sync ? (
          <div style={styles.syncBody}>尚無同步紀錄</div>
        ) : (
          <div style={styles.syncBody}>
            <span style={{ ...styles.syncBadge, color: meta.color }}>{meta.icon} {meta.label}</span>
            <span style={styles.syncTime}>{fmt(sync.finishedAt)}</span>
            <span style={styles.syncCounts}>
              ✅ {sync.success}　❌ {sync.failed}　⚠️ {sync.partial}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  title: { margin: 0, color: '#1a237e', fontSize: '22px', fontWeight: 'bold' },
  subtitle: { margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' },
  dbPill: { padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px', marginBottom: '22px' },
  statCard: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '18px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', transition: 'transform 0.1s',
  },
  statIcon: { fontSize: '20px' },
  statNum: { fontSize: '28px', fontWeight: 'bold', color: '#1e293b', lineHeight: 1.1 },
  statLabel: { fontSize: '14px', color: '#64748b' },
  syncCard: {
    backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '18px 20px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  syncHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  syncTitle: { fontSize: '15px', fontWeight: 'bold', color: '#334155' },
  syncLink: { fontSize: '13px', color: '#1a237e', fontWeight: '600' },
  syncBody: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: '#64748b', fontSize: '14px' },
  syncBadge: { fontSize: '15px', fontWeight: 'bold' },
  syncTime: { fontFamily: 'monospace', color: '#94a3b8', fontSize: '13px' },
  syncCounts: { fontSize: '14px', color: '#475569' },
};

export default HomeOverview;
