import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';

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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    padding: '24px',
  },
  headerRow: { marginBottom: '20px' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, color: '#1a237e', fontSize: '22px', fontWeight: 'bold' },
  runBtn: {
    padding: '10px 18px',
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  runningBtn: { backgroundColor: '#86efac', cursor: 'not-allowed' },
  subtitle: { margin: '8px 0 0 0', color: '#64748b', fontSize: '14px', lineHeight: '1.6' },
  statusBox: { textAlign: 'center', padding: '40px', color: '#64748b' },
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
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  row: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    backgroundColor: '#f8fafc',
  },
  rowHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cityName: { fontSize: '16px', fontWeight: 'bold', color: '#334155' },
  code: {
    fontSize: '12px',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '2px 6px',
    borderRadius: '4px',
    marginLeft: '6px',
  },
  updatedAt: { fontSize: '12px', color: '#94a3b8' },
  rowBody: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: {
    flex: '1',
    minWidth: '260px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'monospace',
  },
  saveBtn: {
    padding: '10px 18px',
    backgroundColor: '#1a237e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  savingBtn: { backgroundColor: '#9fa8da', cursor: 'not-allowed' },
};

export default EtlSources;
