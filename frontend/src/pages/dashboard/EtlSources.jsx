import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

// ETL 來源網址設定：三市固定，僅網址可改。
// 按「驗證並儲存」時，後端會先實際下載該網址並檢查必要欄位，通過才寫入 etl_sources。
const EtlSources = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingCode, setSavingCode] = useState(null);
  const [running, setRunning] = useState(false);

  const handleRunEtl = async () => {
    if (!window.confirm('立即重跑 ETL？會在背景下載三市最新資料並匯入資料庫，可能需要數分鐘。')) return;
    setRunning(true);
    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/admin/etl/run`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') throw new Error(data.message || `後端回應 HTTP ${res.status}`);
      alert(data.data?.message || 'ETL 已觸發');
    } catch (err) {
      alert('觸發失敗：' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const fetchSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/admin/etl/sources`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `後端回應 HTTP ${res.status}`);
      }
      setSources(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSources(); }, []);

  const handleUrlChange = (code, url) =>
    setSources(sources.map(s => (s.source === code ? { ...s, url } : s)));

  const handleSave = async (code) => {
    const target = sources.find(s => s.source === code);
    if (!target || !target.url) { alert('請先填入網址'); return; }
    setSavingCode(code);
    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/admin/etl/sources/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') throw new Error(data.message || '儲存失敗');
      alert(`已驗證並儲存 ${target.name}：成功下載 ${data.data.rows} 筆`);
      fetchSources();
    } catch (err) {
      alert('儲存失敗：' + err.message);
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.headerTop}>
          <h2 style={styles.title}>🔗 ETL 來源網址設定</h2>
          <button
            onClick={handleRunEtl}
            disabled={running}
            style={{ ...styles.runBtn, ...(running ? styles.runningBtn : {}) }}
          >
            {running ? '觸發中…' : '▶ 立即重跑 ETL'}
          </button>
        </div>
        <p style={styles.subtitle}>
          每次 ETL 前會從這些網址下載最新 CSV。按「驗證並儲存」會先實際下載並檢查欄位，通過才寫入；三市固定，僅網址可改。
        </p>
      </div>

      {loading ? (
        <div style={styles.statusBox}>⏳ 載入中…</div>
      ) : error ? (
        <div style={styles.errorBox}>
          <h4>❌ 讀取失敗</h4>
          <p>{error}</p>
          <button onClick={fetchSources} style={styles.retryBtn}>重新嘗試</button>
        </div>
      ) : (
        <div style={styles.list}>
          {sources.map(s => (
            <div key={s.source} style={styles.row}>
              <div style={styles.rowHead}>
                <span style={styles.cityName}>{s.name} <code style={styles.code}>{s.source}</code></span>
                <span style={styles.updatedAt}>{s.updated_at ? `最後更新：${s.updated_at}` : '尚未設定'}</span>
              </div>
              <div style={styles.rowBody}>
                <input
                  type="text"
                  value={s.url || ''}
                  onChange={(e) => handleUrlChange(s.source, e.target.value)}
                  placeholder="https://…  CSV 下載網址"
                  style={styles.input}
                />
                <button
                  onClick={() => handleSave(s.source)}
                  disabled={savingCode === s.source}
                  style={{ ...styles.saveBtn, ...(savingCode === s.source ? styles.savingBtn : {}) }}
                >
                  {savingCode === s.source ? '驗證中…' : '驗證並儲存'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  // 卡片容器：白底 + 細灰邊（亮色辦公管理風，捨棄重陰影）
  card: {
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '24px',
    fontFamily: theme.fonts.sans,
  },
  headerRow: { marginBottom: '20px' },
  headerTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '12px', flexWrap: 'wrap',
  },
  // 主標：近黑、字距微縮（modern SaaS 標題慣例）
  title: {
    margin: 0,
    color: c.text,
    fontSize: '18px',
    fontWeight: '600',
    letterSpacing: '-0.015em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  // 立即重跑 ETL：用 success 綠（區隔主操作 vs 一般動作；indigo 留給 form primary）
  runBtn: {
    padding: '8px 14px',
    backgroundColor: c.green,
    color: '#ffffff',
    border: `1px solid ${c.green}`,
    borderRadius: r.md,
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    fontFamily: theme.fonts.sans,
    boxShadow: '0 1px 2px rgba(22, 163, 74, 0.20)',
    transition: 'background 0.15s ease',
  },
  runningBtn: { backgroundColor: '#86efac', cursor: 'not-allowed', boxShadow: 'none' },
  subtitle: {
    margin: '8px 0 0 0',
    color: c.textDim,
    fontSize: '13px',
    lineHeight: '1.6',
  },
  statusBox: {
    textAlign: 'center',
    padding: '40px 24px',
    color: c.textMuted,
    fontSize: '13px',
  },
  errorBox: {
    padding: '16px 20px',
    backgroundColor: c.redSoft,
    color: c.red,
    borderRadius: r.md,
    border: `1px solid rgba(220, 38, 38, 0.25)`,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: '10px',
    padding: '6px 16px',
    backgroundColor: c.red,
    color: 'white',
    border: 'none',
    borderRadius: r.sm,
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    fontFamily: theme.fonts.sans,
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  // 每個來源卡片：白底（與外層卡片區隔靠細邊）
  row: {
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    padding: '16px',
    backgroundColor: c.surface1,
    transition: `border-color ${theme.transition.fast}`,
  },
  rowHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cityName: {
    fontSize: '14px',
    fontWeight: '600',
    color: c.text,
    letterSpacing: '-0.005em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  // 來源代碼徽章：mono、淡灰底
  code: {
    fontSize: '11px',
    backgroundColor: c.surface2,
    color: c.textDim,
    padding: '2px 7px',
    borderRadius: r.sm,
    fontFamily: theme.fonts.mono,
    fontWeight: '500',
    letterSpacing: '0.04em',
  },
  updatedAt: {
    fontSize: '11.5px',
    color: c.textMuted,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.01em',
  },
  rowBody: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'stretch' },
  // 輸入框：白底淺邊框，focus 換 indigo 邊
  input: {
    flex: '1',
    minWidth: '260px',
    padding: '9px 12px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.text,
    fontSize: '13px',
    outline: 'none',
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.01em',
    transition: `border-color ${theme.transition.fast}`,
  },
  // 儲存按鈕：indigo 實心（form primary action）
  saveBtn: {
    padding: '9px 16px',
    backgroundColor: c.brand,
    color: '#ffffff',
    border: `1px solid ${c.brand}`,
    borderRadius: r.md,
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    fontFamily: theme.fonts.sans,
    boxShadow: theme.shadow.brand,
    transition: 'background 0.15s ease',
  },
  savingBtn: {
    backgroundColor: '#a5b4fc',
    borderColor: '#a5b4fc',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};

export default EtlSources;
