import React, { useEffect, useMemo, useState } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';

// 動作與目標翻譯對照表
const ACTION_TEXT = {
  route_create: '新增路線',
  route_delete: '刪除路線',
  route_update: '修改路線',
  station_create: '新增站點',
  station_delete: '刪除站點',
  station_update: '修改站點',
  station_schedule_create: '新增班次',
  station_schedule_delete: '刪除班次',
  station_schedule_update: '修改班次',
};

const TARGET_TEXT = {
  route: '收運路線',
  station: '清運站點',
  station_schedule: '站點班次',
};

// 詳細欄位中文對照表 (對應你後端 Python 寫入的 key)
const DETAIL_LABELS = {
  route_id: '路線 ID',
  station_id: '站點 ID',
  route_name: '路線名稱',
  route_code: '路線代碼',
  station_name: '站點名稱',
  sequence_order: '路線排序序位',
  target_city: '目標縣市',
  city: '縣市',
  district: '行政區',
  village: '村里',
  arrive_time: '抵達時間',
  leave_time: '駛離時間',
  raw: '原始內容',
};

// 解析 details，確保它必定是個物件
const parseDetails = (details) => {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try {
    return JSON.parse(details);
  } catch {
    return { raw: String(details) };
  }
};

// 格式化時間：YYYY-MM-DD HH:mm
const formatTime = (rawValue) => {
  if (!rawValue) return '未提供時間';
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return String(rawValue);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const humanizeAction = (action) => ACTION_TEXT[action] || action || '未分類操作';
const humanizeTarget = (targetType) => TARGET_TEXT[targetType] || targetType || '資料';

// 產生人性化的大標題摘要
const buildSummary = (row, details) => {
  const name = details.station_name || details.route_name || `#${row.target_id ?? '-'}`;
  // 嘗試組合地址 (例如: 台北市大安區)
  const location = [details.target_city || details.city, details.district, details.village]
    .filter(Boolean)
    .join('');
  const locStr = location ? ` (${location})` : '';
  
  return `${humanizeAction(row.action)}：${name}${locStr}`;
};

// 產生詳細網格的資料陣列
const buildDetailItems = (details) => Object.entries(details)
  .filter(([, value]) => value !== null && value !== undefined && value !== '')
  .map(([key, value]) => ({
    label: DETAIL_LABELS[key] || key,
    value: typeof value === 'boolean' ? (value ? '是' : '否') : String(value),
  }));

const HistoryCard = ({ row }) => {
  const details = parseDetails(row.details);
  const detailItems = buildDetailItems(details);
  
  // 依照操作類型給予不同顏色的 Badge
  const badgeStyle = String(row.action).includes('delete')
    ? styles.deleteBadge
    : String(row.action).includes('update')
      ? styles.updateBadge
      : styles.createBadge;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.headerLeft}>
          <span style={{ ...styles.actionBadge, ...badgeStyle }}>{humanizeAction(row.action)}</span>
          <span style={styles.targetBadge}>{humanizeTarget(row.target_type)}</span>
        </div>
        <span style={styles.timeText}>{formatTime(row.created_at)}</span>
      </div>

      <div style={styles.summary}>{buildSummary(row, details)}</div>

      <div style={styles.metaRow}>
        <span>操作人員：{row.actor_email || `UID: ${row.actor_user_id ?? '系統'}`}</span>
        <span>系統紀錄編號：#{row.log_id}</span>
      </div>

      <div style={styles.detailsPanel}>
        <div style={styles.detailsTitle}>📝 變更詳細內容</div>
        {detailItems.length === 0 ? (
          <div style={styles.emptyDetail}>此操作未附帶額外詳細欄位。</div>
        ) : (
          <div style={styles.detailGrid}>
            {detailItems.map((item, index) => (
              <div key={`${row.log_id}-${item.label}-${index}`} style={styles.detailItem}>
                <div style={styles.detailLabel}>{item.label}</div>
                <div style={styles.detailValue}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ActionHistoryLog = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAudit = async () => {
    try {
      setLoading(true);
      setError('');
      const baseUrl = await getBackendUrl();
      // 在前端請求時直接帶入目標參數，也可以留空讓前端過濾
      const res = await authedFetch(`${baseUrl}/api/admin/audit-log?limit=150`);
      if (!res.ok) throw new Error('歷史紀錄載入失敗');
      const payload = await res.json();
      setItems(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setItems([]);
      setError(err.message || '歷史紀錄載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  // 確保只顯示與路線、站點有關的紀錄
  const visibleItems = useMemo(() => items.filter((item) => {
    const action = String(item.action || '').toLowerCase();
    const target = String(item.target_type || '').toLowerCase();
    return action.includes('route') || action.includes('station') || target.includes('route') || target.includes('station');
  }), [items]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.topBar}>
        <div>
          <h3 style={styles.title}>🧾 路線與站點變更歷史紀錄</h3>
          <div style={styles.subtitle}>調閱由管理員執行的站點、路線之新增、修改與刪除軌跡。</div>
        </div>
        <button type="button" onClick={loadAudit} style={styles.refreshBtn}>🔄 重新整理</button>
      </div>

      {loading ? <div style={styles.noticeBox}>⏳ 正在載入歷史紀錄...</div> : null}
      {!loading && error ? <div style={styles.errorBox}>{error}</div> : null}
      {!loading && !error && visibleItems.length === 0 ? (
        <div style={styles.noticeBox}>目前沒有可顯示的站點與路線歷史紀錄。</div>
      ) : null}

      {!loading && !error && visibleItems.length > 0 ? (
        <div style={styles.list}>
          {visibleItems.map((row, index) => (
            <HistoryCard key={row.log_id || `${row.action}-${row.target_id}-${index}`} row={row} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '16px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '18px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)', border: '1px solid #dbe4ff' },
  title: { margin: '0 0 6px 0', color: '#1e293b', fontSize: '18px', fontWeight: 'bold' },
  subtitle: { color: '#64748b', fontSize: '13px', lineHeight: '1.6' },
  refreshBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #c7d2fe', backgroundColor: '#ffffff', color: '#3730a3', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: '0.2s' },
  noticeBox: { textAlign: 'center', padding: '26px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', color: '#64748b' },
  errorBox: { padding: '16px', borderRadius: '12px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 'bold' },
  list: { display: 'flex', flexDirection: 'column', gap: '14px' },
  card: { backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  headerLeft: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  actionBadge: { padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' },
  createBadge: { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  updateBadge: { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  deleteBadge: { backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
  targetBadge: { padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
  timeText: { fontSize: '12px', color: '#64748b', fontWeight: 'bold' },
  summary: { marginTop: '12px', fontSize: '16px', color: '#0f172a', fontWeight: 'bold', lineHeight: '1.5' },
  metaRow: { marginTop: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569' },
  detailsPanel: { marginTop: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '14px' },
  detailsTitle: { fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '12px' },
  emptyDetail: { color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' },
  detailItem: { backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '8px 12px' },
  detailLabel: { fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' },
  detailValue: { fontSize: '13px', color: '#0f172a', lineHeight: '1.5', wordBreak: 'break-word', fontWeight: '500' },
};

export default ActionHistoryLog;