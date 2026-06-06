import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../../utils/api';

// 垃圾袋規範編輯器（規則與公告的第 3 分頁）。
// 讀取沿用公開 GET /api/info/bag-regulations?city=；寫入走 /api/admin/bag-regulations。
// city 僅台北市 / 新北市（對齊 DB enum）。每市多筆，逐列新增 / 儲存 / 刪除。
const CITIES = ['台北市', '新北市'];
const EMPTY_ROW = { bag_size: '', volume_liters: '', price: '', purchase_locations: '', notes: '' };

const BagRegulationsEditor = () => {
  const [city, setCity] = useState('台北市');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingIdx, setSavingIdx] = useState(null);

  const fetchRows = async (c) => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/info/bag-regulations?city=${encodeURIComponent(c)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') throw new Error(data.message || `HTTP ${res.status}`);
      // 把 null 轉成 '' 方便綁定輸入框
      setRows((data.data || []).map(r => ({
        reg_id: r.reg_id,
        bag_size: r.bag_size ?? '',
        volume_liters: r.volume_liters ?? '',
        price: r.price ?? '',
        purchase_locations: r.purchase_locations ?? '',
        notes: r.notes ?? '',
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(city); }, [city]);

  const setField = (idx, key, val) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  const addRow = () => setRows([...rows, { ...EMPTY_ROW }]);

  const handleSave = async (idx) => {
    const row = rows[idx];
    if (!row.bag_size.trim()) { alert('請填寫袋子規格（例如 14L、大型）'); return; }
    setSavingIdx(idx);
    try {
      const baseUrl = await getBackendUrl();
      const payload = {
        city,
        bag_size: row.bag_size,
        volume_liters: row.volume_liters,
        price: row.price,
        purchase_locations: row.purchase_locations,
        notes: row.notes,
      };
      const isNew = row.reg_id == null;
      const url = isNew
        ? `${baseUrl}/api/admin/bag-regulations`
        : `${baseUrl}/api/admin/bag-regulations/${row.reg_id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') throw new Error(data.message || `HTTP ${res.status}`);
      await fetchRows(city);   // 重新載入以拿到 reg_id 與正規化後的值
    } catch (err) {
      alert('儲存失敗：' + err.message);
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDelete = async (idx) => {
    const row = rows[idx];
    // 尚未存檔的新列：直接從畫面移除
    if (row.reg_id == null) { setRows(rows.filter((_, i) => i !== idx)); return; }
    if (!window.confirm(`確定刪除「${row.bag_size}」這筆垃圾袋規範？`)) return;
    try {
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/admin/bag-regulations/${row.reg_id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') throw new Error(data.message || `HTTP ${res.status}`);
      await fetchRows(city);
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  return (
    <div>
      {/* 縣市選擇 */}
      <div style={styles.citySelectorRow}>
        <span style={{ fontWeight: 'bold', fontSize: '15px' }}>🏢 當前維護縣市：</span>
        {CITIES.map(c => (
          <button key={c} onClick={() => setCity(c)}
            style={{ ...styles.cityTabBtn, ...(city === c ? styles.cityTabActive : {}) }}>
            {c}
          </button>
        ))}
        <span style={styles.hint}>（基隆市無專用垃圾袋，故不在此）</span>
      </div>

      {loading ? (
        <div style={styles.statusBox}>⏳ 載入中…</div>
      ) : error ? (
        <div style={styles.errorBox}>❌ 讀取失敗：{error}　<button onClick={() => fetchRows(city)} style={styles.retryBtn}>重試</button></div>
      ) : (
        <>
          {rows.length === 0 && <div style={styles.statusBox}>{city} 目前沒有垃圾袋規範，按下方「新增一列」建立。</div>}

          {rows.map((row, idx) => (
            <div key={row.reg_id ?? `new-${idx}`} style={styles.rowCard}>
              <div style={styles.fieldGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>袋子規格 *</span>
                  <input style={styles.input} value={row.bag_size}
                    onChange={e => setField(idx, 'bag_size', e.target.value)} placeholder="例：14 公升 / 大型" />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>容量（公升）</span>
                  <input style={styles.input} type="number" step="0.1" value={row.volume_liters}
                    onChange={e => setField(idx, 'volume_liters', e.target.value)} placeholder="14" />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>價格（NT$）</span>
                  <input style={styles.input} type="number" step="0.01" value={row.price}
                    onChange={e => setField(idx, 'price', e.target.value)} placeholder="5.00" />
                </label>
              </div>
              <label style={styles.fieldFull}>
                <span style={styles.label}>購買地點</span>
                <input style={styles.input} value={row.purchase_locations}
                  onChange={e => setField(idx, 'purchase_locations', e.target.value)} placeholder="便利商店、超市、區公所…" />
              </label>
              <label style={styles.fieldFull}>
                <span style={styles.label}>備註</span>
                <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '48px' }} rows="2" value={row.notes}
                  onChange={e => setField(idx, 'notes', e.target.value)} placeholder="其他說明（可留空）" />
              </label>
              <div style={styles.rowActions}>
                <span style={styles.regTag}>{row.reg_id == null ? '🆕 未儲存' : `reg_id: ${row.reg_id}`}</span>
                <button onClick={() => handleSave(idx)} disabled={savingIdx === idx}
                  style={{ ...styles.saveBtn, ...(savingIdx === idx ? styles.savingBtn : {}) }}>
                  {savingIdx === idx ? '儲存中…' : '💾 儲存'}
                </button>
                <button onClick={() => handleDelete(idx)} style={styles.deleteBtn}>🗑️ 刪除</button>
              </div>
            </div>
          ))}

          <button onClick={addRow} style={styles.addBtn}>➕ 新增一列</button>
        </>
      )}
    </div>
  );
};

const styles = {
  citySelectorRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  cityTabBtn: { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '20px', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' },
  cityTabActive: { backgroundColor: '#0284c7', color: 'white', borderColor: '#0284c7' },
  hint: { fontSize: '12px', color: '#94a3b8' },
  statusBox: { textAlign: 'center', padding: '30px', color: '#64748b' },
  errorBox: { padding: '16px', backgroundColor: '#fff5f5', color: '#e53e3e', borderRadius: '8px', border: '1px solid #fed7d7' },
  retryBtn: { padding: '4px 12px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  rowCard: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '14px', backgroundColor: '#f8fafc' },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldFull: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' },
  label: { fontSize: '13px', color: '#475569', fontWeight: '600' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  rowActions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  regTag: { fontSize: '12px', color: '#94a3b8', marginRight: 'auto', fontFamily: 'monospace' },
  saveBtn: { padding: '8px 18px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  savingBtn: { backgroundColor: '#9fa8da', cursor: 'not-allowed' },
  deleteBtn: { padding: '8px 14px', backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  addBtn: { padding: '12px', width: '100%', backgroundColor: '#e8eaf6', color: '#1a237e', border: '1px dashed #9fa8da', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
};

export default BagRegulationsEditor;
