import React, { useEffect, useMemo, useState } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

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

  // 頁首：暖底 + 細邊，不再用 indigo 漸層
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '18px 22px',
    borderRadius: r.lg,
    backgroundColor: c.bg,
    border: `1px solid ${c.border}`,
  },
  title: {
    margin: '0 0 4px 0',
    color: c.text,
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '-0.005em',
  },
  subtitle: {
    color: c.textMuted,
    fontSize: '12.5px',
    lineHeight: '1.55',
  },
  refreshBtn: {
    padding: '8px 14px',
    borderRadius: r.sm,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.text,
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '12.5px',
    fontFamily: theme.fonts.sans,
    transition: `background ${theme.transition.fast}, border-color ${theme.transition.fast}`,
  },

  noticeBox: {
    textAlign: 'center',
    padding: '32px 24px',
    borderRadius: r.md,
    backgroundColor: c.surface1,
    border: `1px dashed ${c.border}`,
    color: c.textMuted,
    fontSize: '13px',
  },
  errorBox: {
    padding: '14px 18px',
    borderRadius: r.md,
    backgroundColor: c.redSoft,
    border: `1px solid ${c.redSoft}`,
    color: c.red,
    fontWeight: '600',
    fontSize: '13px',
  },

  list: { display: 'flex', flexDirection: 'column', gap: '12px' },

  // 紀錄卡：白底、暖邊、左 3px 條（依動作類別著色，於 inline 設定）
  card: {
    backgroundColor: c.surface1,
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    padding: '18px 20px',
    boxShadow: theme.shadow.sm,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },

  // 動作 badge 基底（顏色由 create/update/deleteBadge 覆寫）
  actionBadge: {
    padding: '4px 11px',
    borderRadius: r.sm,
    fontSize: '11.5px',
    fontWeight: '600',
    letterSpacing: '0.02em',
  },
  // 三種語意色 — 使用 theme accents
  createBadge: {
    backgroundColor: c.greenSoft,
    color: c.green,
    border: `1px solid ${c.greenSoft}`,
  },
  updateBadge: {
    backgroundColor: c.blueSoft,
    color: c.blue,
    border: `1px solid ${c.blueSoft}`,
  },
  deleteBadge: {
    backgroundColor: c.redSoft,
    color: c.red,
    border: `1px solid ${c.redSoft}`,
  },
  // 對象 badge — 暖棕（brand soft）
  targetBadge: {
    padding: '4px 11px',
    borderRadius: r.sm,
    fontSize: '11.5px',
    fontWeight: '600',
    backgroundColor: c.brandSoft,
    color: c.brand,
    border: `1px solid ${c.brandTint}`,
    letterSpacing: '0.02em',
  },
  timeText: {
    fontSize: '11.5px',
    color: c.textMuted,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.02em',
  },

  summary: {
    marginTop: '14px',
    fontSize: '15px',
    color: c.text,
    fontWeight: '600',
    lineHeight: '1.5',
    letterSpacing: '-0.005em',
  },
  metaRow: {
    marginTop: '10px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    fontSize: '12.5px',
    color: c.textDim,
  },

  // 變更詳細內容區塊
  detailsPanel: {
    marginTop: '16px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    backgroundColor: c.bg,
    padding: '14px 16px',
  },
  detailsTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: c.textMuted,
    marginBottom: '12px',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
  },
  emptyDetail: {
    color: c.textFaint,
    fontStyle: 'italic',
    fontSize: '12.5px',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '10px',
  },
  detailItem: {
    backgroundColor: c.surface1,
    borderRadius: r.sm,
    border: `1px solid ${c.border}`,
    padding: '8px 12px',
  },
  detailLabel: {
    fontSize: '10.5px',
    color: c.textMuted,
    fontWeight: '600',
    marginBottom: '4px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '13px',
    color: c.text,
    lineHeight: '1.5',
    wordBreak: 'break-word',
    fontWeight: '500',
    fontFamily: theme.fonts.mono,
  },
};

export default ActionHistoryLog;