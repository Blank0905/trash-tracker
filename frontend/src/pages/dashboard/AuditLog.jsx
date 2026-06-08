import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

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

  const chip = (active, label, onClick) => (
    <button onClick={onClick} style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}>
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
            {actionChips.map(c => chip(fAction === c.key, c.label, () => onPickAction(c.key)))}
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
  card: {
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '24px',
    fontFamily: theme.fonts.sans,
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: c.text, fontSize: '18px', fontWeight: '600', letterSpacing: '-0.015em' },
  subtitle: { margin: '6px 0 18px 0', color: c.textDim, fontSize: '13px', lineHeight: '1.55' },
  refreshBtn: {
    padding: '7px 14px', backgroundColor: c.surface1, color: c.text,
    border: `1px solid ${c.border}`, borderRadius: r.sm, fontWeight: '500',
    cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', fontFamily: theme.fonts.sans,
    transition: 'background 0.15s ease',
  },
  filterBlock: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '12px 14px', backgroundColor: c.surface2, borderRadius: r.md,
    border: `1px solid ${c.border}`, marginBottom: '16px',
  },
  filterRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  filterLabel: {
    fontSize: '11px', fontWeight: '600', color: c.textMuted,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    width: '40px', flexShrink: 0, paddingTop: '7px',
  },
  chipWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    padding: '5px 11px', borderRadius: r.pill, border: `1px solid ${c.border}`,
    backgroundColor: c.surface1, color: c.textDim, fontSize: '12.5px',
    cursor: 'pointer', fontWeight: '500', fontFamily: theme.fonts.sans,
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  },
  chipActive: { backgroundColor: c.brand, borderColor: c.brand, color: '#ffffff', fontWeight: '600' },
  resultHint: {
    fontSize: '12px', color: c.textMuted, marginBottom: '8px',
    fontFamily: theme.fonts.mono, letterSpacing: '0.02em',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: {
    border: `1px solid ${c.border}`, borderRadius: r.md,
    padding: '12px 14px', backgroundColor: c.surface1,
    transition: `border-color ${theme.transition.fast}`,
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  badge: { padding: '3px 10px', borderRadius: r.sm, fontSize: '12px', fontWeight: '600' },
  target: {
    fontSize: '12px', color: c.textDim, backgroundColor: c.surface2,
    padding: '2px 8px', borderRadius: r.sm,
    fontFamily: theme.fonts.mono, letterSpacing: '0.01em',
  },
  actor: { fontSize: '12.5px', color: c.text, fontWeight: '500' },
  time: {
    fontSize: '11.5px', color: c.textMuted, marginLeft: 'auto',
    fontFamily: theme.fonts.mono, letterSpacing: '0.01em',
  },
  details: {
    marginTop: '8px', marginBottom: 0, fontSize: '12px', color: c.textDim, lineHeight: '1.55',
    backgroundColor: c.surface2, borderRadius: r.sm, padding: '8px 10px',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: theme.fonts.mono, border: `1px solid ${c.border}`,
  },
  metaFoot: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '8px', fontSize: '10.5px', color: c.textFaint,
    fontFamily: theme.fonts.mono, gap: '8px', letterSpacing: '0.02em',
  },
  logId: { color: c.textFaint },
  pager: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
    marginTop: '16px', padding: '12px', backgroundColor: c.surface2,
    borderRadius: r.md, border: `1px solid ${c.border}`,
  },
  pagerBtn: {
    padding: '6px 14px', backgroundColor: c.surface1, color: c.text,
    border: `1px solid ${c.border}`, borderRadius: r.sm,
    fontWeight: '500', cursor: 'pointer', fontSize: '12.5px', fontFamily: theme.fonts.sans,
  },
  pagerInfo: {
    fontSize: '12.5px', color: c.textDim, fontWeight: '500',
    minWidth: '60px', textAlign: 'center', fontFamily: theme.fonts.mono,
  },
  statusBox: { textAlign: 'center', padding: '40px 24px', color: c.textMuted, fontSize: '13px' },
  errorBox: {
    padding: '16px 20px', backgroundColor: c.redSoft, color: c.red,
    borderRadius: r.md, border: `1px solid rgba(220, 38, 38, 0.25)`, textAlign: 'center',
  },
  retryBtn: {
    marginTop: '10px', padding: '6px 16px', backgroundColor: c.red, color: 'white',
    border: 'none', borderRadius: r.sm, cursor: 'pointer', fontWeight: '600',
    fontSize: '13px', fontFamily: theme.fonts.sans,
  },
};

export default AuditLog;
