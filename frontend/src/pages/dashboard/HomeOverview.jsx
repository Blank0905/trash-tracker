import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

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
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: '12px', flexWrap: 'wrap', marginBottom: '20px',
    fontFamily: theme.fonts.sans,
  },
  title: { margin: 0, color: c.text, fontSize: '20px', fontWeight: '600', letterSpacing: '-0.015em' },
  subtitle: { margin: '6px 0 0 0', color: c.textDim, fontSize: '13px' },
  // DB 連線徽章：用 green / red soft 而非實心強烈色
  dbPill: {
    padding: '5px 11px', borderRadius: r.pill,
    fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
    fontFamily: theme.fonts.sans, letterSpacing: '0.01em',
    border: `1px solid transparent`,
  },
  // 筆數卡片網格
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px', marginBottom: '20px',
  },
  // 單張統計卡：白底細邊框、hover 微亮（CSS hover 透過 onMouseEnter 才生效；此處只設靜態）
  statCard: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    backgroundColor: c.surface1,
    border: `1px solid ${c.border}`,
    borderRadius: r.lg,
    padding: '16px 18px', cursor: 'pointer',
    transition: `border-color ${theme.transition.fast}, transform ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
  },
  statIcon: { fontSize: '18px' },
  // 主數字大字 + tabular nums 對齊（看起來像儀表板）
  statNum: {
    fontSize: '26px', fontWeight: '700', color: c.text,
    lineHeight: 1.1, letterSpacing: '-0.02em',
    fontFeatureSettings: '"tnum" 1',
  },
  statLabel: {
    fontSize: '12.5px', color: c.textDim,
    letterSpacing: '0.005em',
  },
  // 同步狀態卡
  syncCard: {
    backgroundColor: c.surface1,
    border: `1px solid ${c.border}`,
    borderRadius: r.lg,
    padding: '16px 20px', cursor: 'pointer',
    transition: `border-color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
  },
  syncHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  syncTitle: { fontSize: '14px', fontWeight: '600', color: c.text, letterSpacing: '-0.005em' },
  syncLink: { fontSize: '12px', color: c.brand, fontWeight: '500' },
  syncBody: {
    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
    color: c.textDim, fontSize: '13px',
  },
  syncBadge: { fontSize: '13px', fontWeight: '600' },
  syncTime: { fontFamily: theme.fonts.mono, color: c.textMuted, fontSize: '12px', letterSpacing: '0.01em' },
  syncCounts: { fontSize: '13px', color: c.textDim, fontFamily: theme.fonts.mono, letterSpacing: '0.02em' },
};

export default HomeOverview;
