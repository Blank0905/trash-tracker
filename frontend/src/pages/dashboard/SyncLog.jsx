import React, { useState, useEffect, useMemo } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

// api_sync_log 人性化檢視頁：彩色狀態徽章 + 點選式篩選（不用手打），最新在上。
// 資料沿用通用瀏覽端點 /api/db/browse?table=api_sync_log（DESC 取最新一批），前端做篩選。
const FETCH_LIMIT = 1000;

// enum → 中文標籤
const SOURCE_LABEL = { TPE: '台北市', NTPC: '新北市', KLU: '基隆市' };
const PHASE_LABEL = { download: '下載 CSV', import: '匯入 DB' };
const STATUS_META = {
  success: { label: '成功', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
  failed:  { label: '失敗', color: '#dc2626', bg: '#fee2e2', icon: '❌' },
  partial: { label: '部分', color: '#d97706', bg: '#fef3c7', icon: '⚠️' },
};

const SyncLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fStatus, setFStatus] = useState('all');
  const [fSource, setFSource] = useState('all');
  const [fPhase, setFPhase] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();
      const url = `${baseUrl}/api/db/browse?table=api_sync_log&page=1&limit=${FETCH_LIMIT}&sort=DESC&search=`;
      const res = await authedFetch(url);
      if (!res.ok) throw new Error(`後端回應 HTTP ${res.status}`);
      const result = await res.json();
      setLogs(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // 各狀態筆數（以抓回來的資料為準，顯示在篩選鈕上）
  const counts = useMemo(() => {
    const c = { all: logs.length, success: 0, failed: 0, partial: 0 };
    logs.forEach(l => { if (c[l.status] !== undefined) c[l.status] += 1; });
    return c;
  }, [logs]);

  const filtered = useMemo(() => logs.filter(l =>
    (fStatus === 'all' || l.status === fStatus) &&
    (fSource === 'all' || l.source === fSource) &&
    (fPhase === 'all' || l.phase === fPhase)
  ), [logs, fStatus, fSource, fPhase]);

  // 期間：有起訖就算秒數
  const duration = (s, f) => {
    if (!s || !f) return '';
    const ms = new Date(String(f).replace(' ', 'T')) - new Date(String(s).replace(' ', 'T'));
    if (isNaN(ms) || ms < 0) return '';
    return `（耗時 ${(ms / 1000).toFixed(1)} 秒）`;
  };
  const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 19) : '—');

  const chip = (active, label, onClick, extra = {}) => (
    <button onClick={onClick} style={{ ...styles.chip, ...(active ? { ...styles.chipActive, ...extra } : {}) }}>
      {label}
    </button>
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerTop}>
        <h2 style={styles.title}>🔄 API 同步紀錄</h2>
        <button onClick={fetchLogs} disabled={loading} style={styles.refreshBtn}>
          {loading ? '載入中…' : '↻ 重新整理'}
        </button>
      </div>
      <p style={styles.subtitle}>每週日凌晨 02:00 自動同步、或手動重跑 ETL 的結果。點下方標籤即可篩選，最新的在最上面。</p>

      {/* 篩選列：狀態 / 來源 / 階段 */}
      <div style={styles.filterBlock}>
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>狀態</span>
          {chip(fStatus === 'all', `全部 (${counts.all})`, () => setFStatus('all'))}
          {chip(fStatus === 'failed', `❌ 失敗 (${counts.failed})`, () => setFStatus('failed'),
            { backgroundColor: STATUS_META.failed.color, borderColor: STATUS_META.failed.color })}
          {chip(fStatus === 'partial', `⚠️ 部分 (${counts.partial})`, () => setFStatus('partial'),
            { backgroundColor: STATUS_META.partial.color, borderColor: STATUS_META.partial.color })}
          {chip(fStatus === 'success', `✅ 成功 (${counts.success})`, () => setFStatus('success'),
            { backgroundColor: STATUS_META.success.color, borderColor: STATUS_META.success.color })}
        </div>
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>來源</span>
          {chip(fSource === 'all', '全部', () => setFSource('all'))}
          {chip(fSource === 'TPE', '台北市', () => setFSource('TPE'))}
          {chip(fSource === 'NTPC', '新北市', () => setFSource('NTPC'))}
          {chip(fSource === 'KLU', '基隆市', () => setFSource('KLU'))}
        </div>
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>階段</span>
          {chip(fPhase === 'all', '全部', () => setFPhase('all'))}
          {chip(fPhase === 'download', '下載 CSV', () => setFPhase('download'))}
          {chip(fPhase === 'import', '匯入 DB', () => setFPhase('import'))}
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
      ) : filtered.length === 0 ? (
        <div style={styles.statusBox}>目前沒有符合條件的紀錄。</div>
      ) : (
        <div style={styles.list}>
          <div style={styles.resultHint}>共 {filtered.length} 筆（取最新 {FETCH_LIMIT} 筆內篩選）</div>
          {filtered.map(l => {
            const meta = STATUS_META[l.status] || { label: l.status, color: '#64748b', bg: '#f1f5f9', icon: '•' };
            return (
              <div key={l.log_id} style={{ ...styles.row, borderLeft: `5px solid ${meta.color}` }}>
                <div style={styles.rowHead}>
                  <span style={{ ...styles.badge, color: meta.color, backgroundColor: meta.bg }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={styles.source}>{SOURCE_LABEL[l.source] || l.source}</span>
                  <span style={styles.phase}>{PHASE_LABEL[l.phase] || l.phase}</span>
                  {l.records_affected != null && (
                    <span style={styles.records}>{l.records_affected} 筆</span>
                  )}
                  <span style={styles.time}>{fmt(l.finished_at)} {duration(l.started_at, l.finished_at)}</span>
                </div>
                {l.message && <div style={styles.message}>{l.message}</div>}
                <div style={styles.runId} title="同一次排程的關聯鍵">run: {String(l.run_id).slice(0, 8)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: c.surface1, borderRadius: r.lg,
    border: `1px solid ${c.border}`, padding: '24px',
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
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '12px 14px', backgroundColor: c.surface2, borderRadius: r.md,
    border: `1px solid ${c.border}`, marginBottom: '16px',
  },
  filterRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  filterLabel: {
    fontSize: '11px', fontWeight: '600', color: c.textMuted,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    width: '40px', flexShrink: 0,
  },
  chip: {
    padding: '5px 11px', borderRadius: r.pill, border: `1px solid ${c.border}`,
    backgroundColor: c.surface1, color: c.textDim, fontSize: '12.5px',
    cursor: 'pointer', fontWeight: '500', fontFamily: theme.fonts.sans,
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  },
  chipActive: { backgroundColor: c.brand, borderColor: c.brand, color: '#ffffff', fontWeight: '600' },
  resultHint: {
    fontSize: '12px', color: c.textMuted, marginBottom: '6px',
    fontFamily: theme.fonts.mono, letterSpacing: '0.02em',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: {
    border: `1px solid ${c.border}`, borderRadius: r.md,
    padding: '12px 14px', backgroundColor: c.surface1,
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  badge: { padding: '3px 10px', borderRadius: r.sm, fontSize: '12px', fontWeight: '600' },
  source: { fontSize: '13px', fontWeight: '600', color: c.text },
  phase: {
    fontSize: '12px', color: c.textDim, backgroundColor: c.surface2,
    padding: '2px 8px', borderRadius: r.sm,
    fontFamily: theme.fonts.mono, letterSpacing: '0.01em',
  },
  records: {
    fontSize: '12.5px', color: c.brand, fontWeight: '600',
    fontFamily: theme.fonts.mono, letterSpacing: '0.01em',
  },
  time: {
    fontSize: '11.5px', color: c.textMuted, marginLeft: 'auto',
    fontFamily: theme.fonts.mono, letterSpacing: '0.01em',
  },
  message: {
    marginTop: '8px', fontSize: '12.5px', color: c.textDim, lineHeight: '1.55',
    backgroundColor: c.surface2, borderRadius: r.sm, padding: '8px 10px',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: theme.fonts.mono, border: `1px solid ${c.border}`,
  },
  runId: {
    marginTop: '6px', fontSize: '10.5px', color: c.textFaint,
    fontFamily: theme.fonts.mono, letterSpacing: '0.02em',
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

export default SyncLog;
