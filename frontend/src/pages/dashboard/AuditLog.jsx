import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';

// 管理者操作審計檢視頁：唯讀。資料來自 /api/admin/audit-log（DESC 最新在前）。
// 篩選用後端參數（不在前端做 client-side filter），避免漏看跨頁紀錄。
const PAGE_SIZE = 50;

// action enum → 顯示標籤 + 顏色（沒在表上的會 fallback 成中性灰）
const ACTION_META = {
  user_promote:         { label: '升級權限',   icon: '⬆️', color: '#0369a1', bg: '#dbeafe' },
  user_suspend:         { label: '停權使用者', icon: '🚫', color: '#b91c1c', bg: '#fee2e2' },
  announcement_create:  { label: '建立公告',   icon: '📝', color: '#15803d', bg: '#dcfce7' },
  announcement_update:  { label: '修改公告',   icon: '✏️', color: '#a16207', bg: '#fef3c7' },
  announcement_push:    { label: '推播公告',   icon: '📢', color: '#7c3aed', bg: '#ede9fe' },
  etl_source_update:    { label: '改 ETL 來源', icon: '🔗', color: '#0e7490', bg: '#cffafe' },
  etl_run:              { label: '觸發 ETL',   icon: '▶️', color: '#0e7490', bg: '#cffafe' },
  route_delete:         { label: '刪除路線',   icon: '🗑️', color: '#dc2626', bg: '#fee2e2' },
  station_delete:       { label: '刪除站點',   icon: '🗑️', color: '#dc2626', bg: '#fee2e2' },
};

const TARGET_LABEL = {
  user: '使用者', announcement: '公告', etl_source: 'ETL 來源', route: '路線', station: '站點',
};

const fmtTime = (t) => (t ? String(t).replace('T', ' ').slice(0, 19) : '—');

// details 可能是 JSON 字串、dict、或 null；統一轉成 dict 或 null
const parseDetails = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return { _raw: String(raw) }; }
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fAction, setFAction] = useState('all');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (fAction !== 'all') params.set('action', fAction);

      const res = await authedFetch(`${baseUrl}/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `後端回應 HTTP ${res.status}`);
      }
      const body = await res.json();
      setLogs(body.data || []);
      setTotal(body.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, fAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 切換篩選時自動回到第 1 頁
  const onPickAction = (a) => { setFAction(a); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 篩選 chip 用的 action 清單（含全部）
  const actionChips = useMemo(() => [
    { key: 'all', label: '全部' },
    ...Object.entries(ACTION_META).map(([k, v]) => ({ key: k, label: `${v.icon} ${v.label}` })),
  ], []);

  //因為我要沿用 但chip呼叫在map迴圈裡要key不然我那邊會炸 在actionhistorylog.jsx 如果你要改回來或是修正可以再改
  const chip = (key, active, label, onClick) => (
    <button key={key} onClick={onClick} style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}>
      {label}
    </button>
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerTop}>
        <h2 style={styles.title}>🛡️ 管理者操作紀錄</h2>
        <button onClick={fetchLogs} disabled={loading} style={styles.refreshBtn}>
          {loading ? '載入中…' : '↻ 重新整理'}
        </button>
      </div>
      <p style={styles.subtitle}>
        所有敏感 / 高權限 / 不可逆的管理操作（升降權、停權、公告推播、ETL、刪除等）皆會留下紀錄，append-only 不可修改。
      </p>

      {/* 篩選列 */}
      <div style={styles.filterBlock}>
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>動作</span>
          <div style={styles.chipWrap}>
            {actionChips.map(c => chip(c.key, fAction === c.key, c.label, () => onPickAction(c.key)))} 
          </div>
        </div>
      </div>

      {loading ? (
        <div style={styles.statusBox}>⏳ 載入中…</div>
      ) : error ? (
        <div style={styles.errorBox}>
          <h4>❌ 讀取失敗</h4>
          <p>{error}</p>
          <button onClick={fetchLogs} style={styles.retryBtn}>重新嘗試</button>
        </div>
      ) : logs.length === 0 ? (
        <div style={styles.statusBox}>目前沒有符合條件的紀錄。</div>
      ) : (
        <>
          <div style={styles.resultHint}>
            共 {total} 筆 · 第 {page} / {totalPages} 頁
          </div>

          <div style={styles.list}>
            {logs.map(l => {
              const meta = ACTION_META[l.action] || { label: l.action, icon: '•', color: '#64748b', bg: '#f1f5f9' };
              const details = parseDetails(l.details);
              return (
                <div key={l.log_id} style={{ ...styles.row, borderLeft: `5px solid ${meta.color}` }}>
                  <div style={styles.rowHead}>
                    <span style={{ ...styles.badge, color: meta.color, backgroundColor: meta.bg }}>
                      {meta.icon} {meta.label}
                    </span>
                    {l.target_type && (
                      <span style={styles.target}>
                        {TARGET_LABEL[l.target_type] || l.target_type}
                        {l.target_id != null && ` #${l.target_id}`}
                      </span>
                    )}
                    <span style={styles.actor}>
                      👤 {l.actor_email || `user_id=${l.actor_user_id}`}
                    </span>
                    <span style={styles.time}>{fmtTime(l.created_at)}</span>
                  </div>

                  {details && Object.keys(details).length > 0 && (
                    <pre style={styles.details}>{JSON.stringify(details, null, 2)}</pre>
                  )}

                  <div style={styles.metaFoot}>
                    {l.ip_address && <span>IP: {l.ip_address}</span>}
                    <span style={styles.logId}>log #{l.log_id}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <div style={styles.pager}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                style={styles.pagerBtn}
              >
                ← 上一頁
              </button>
              <span style={styles.pagerInfo}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                style={styles.pagerBtn}
              >
                下一頁 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const styles = {
  card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#1a237e', fontSize: '22px', fontWeight: 'bold' },
  subtitle: { margin: '8px 0 16px 0', color: '#64748b', fontSize: '14px', lineHeight: '1.6' },
  refreshBtn: {
    padding: '8px 16px', backgroundColor: '#1a237e', color: 'white', border: 'none',
    borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap',
  },
  filterBlock: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '10px',
    border: '1px solid #e2e8f0', marginBottom: '18px',
  },
  filterRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  filterLabel: { fontSize: '13px', fontWeight: '700', color: '#475569', width: '40px', flexShrink: 0, paddingTop: '7px' },
  chipWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    padding: '6px 12px', borderRadius: '999px', border: '1px solid #cbd5e1',
    backgroundColor: '#fff', color: '#475569', fontSize: '13px', cursor: 'pointer', fontWeight: '600',
  },
  chipActive: { backgroundColor: '#1a237e', border: '1px solid #1a237e', color: '#fff' },
  resultHint: { fontSize: '13px', color: '#94a3b8', marginBottom: '8px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', backgroundColor: '#fff' },
  rowHead: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  badge: { padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' },
  target: { fontSize: '13px', color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' },
  actor: { fontSize: '13px', color: '#334155', fontWeight: '600' },
  time: { fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', fontFamily: 'monospace' },
  details: {
    marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5',
    backgroundColor: '#f8fafc', borderRadius: '6px', padding: '8px 10px',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace',
  },
  metaFoot: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '8px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', gap: '8px',
  },
  logId: { color: '#cbd5e1' },
  pager: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
    marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px',
  },
  pagerBtn: {
    padding: '6px 14px', backgroundColor: '#1a237e', color: 'white', border: 'none',
    borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px',
  },
  pagerInfo: { fontSize: '13px', color: '#475569', fontWeight: '600', minWidth: '60px', textAlign: 'center' },
  statusBox: { textAlign: 'center', padding: '40px', color: '#64748b' },
  errorBox: { padding: '20px', backgroundColor: '#fff5f5', color: '#e53e3e', borderRadius: '8px', border: '1px solid #fed7d7', textAlign: 'center' },
  retryBtn: { marginTop: '10px', padding: '6px 16px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
};

export default AuditLog;
