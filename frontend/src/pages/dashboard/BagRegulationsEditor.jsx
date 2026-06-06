import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../../utils/api';

// 垃圾袋規範編輯器（規則與公告的第 3 分頁）。
// 讀取沿用公開 GET /api/info/bag-regulations?city=；寫入走 /api/admin/bag-regulations。
// city 僅台北市 / 新北市（對齊 DB enum）。每市多筆，逐列新增 / 儲存 / 刪除。
const CITIES = ['台北市', '新北市'];
const CATEGORIES = ['一般專用', '環保兩用'];
const EMPTY_ROW = {
  category: '一般專用', name: '', volume_liters: '', units_per_pack: '',
  price_per_pack: '', unit_price: '', style: '', purchase_locations: '', notes: '',
};
// 載入的欄位（null → '' 方便綁定輸入框）
const FIELDS = Object.keys(EMPTY_ROW);

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
      setRows((data.data || []).map(r => {
        const row = { reg_id: r.reg_id };
        FIELDS.forEach(f => { row[f] = r[f] ?? ''; });
        return row;
      }));
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
    if (!String(row.name).trim()) { alert('請填寫名稱（例如 14公升袋、環保兩用袋-中型）'); return; }
    setSavingIdx(idx);
    try {
      const baseUrl = await getBackendUrl();
      const payload = { city };
      FIELDS.forEach(f => { payload[f] = row[f]; });
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
      await fetchRows(city);
    } catch (err) {
      alert('儲存失敗：' + err.message);
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDelete = async (idx) => {
    const row = rows[idx];
    if (row.reg_id == null) { setRows(rows.filter((_, i) => i !== idx)); return; }
    if (!window.confirm(`確定刪除「${row.name}」這筆垃圾袋規範？`)) return;
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

  const inputField = (idx, key, label, opts = {}) => (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input style={styles.input} value={rows[idx][key]} type={opts.type || 'text'} step={opts.step}
        placeholder={opts.placeholder || ''} onChange={e => setField(idx, key, e.target.value)} />
    </label>
  );

  return (
    <div>
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
                  <span style={styles.label}>類別</span>
                  <select style={styles.input} value={row.category}
                    onChange={e => setField(idx, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                {inputField(idx, 'name', '名稱 *', { placeholder: '例：14公升袋 / 環保兩用袋-中型' })}
                {inputField(idx, 'volume_liters', '容量（公升）', { type: 'number', step: '0.1', placeholder: '14' })}
                {inputField(idx, 'units_per_pack', '每包個數', { type: 'number', placeholder: '20' })}
                {inputField(idx, 'price_per_pack', '每包售價', { type: 'number', step: '0.01', placeholder: '100' })}
                {inputField(idx, 'unit_price', '單個單價', { type: 'number', step: '0.01', placeholder: '5' })}
                {inputField(idx, 'style', '式樣', { placeholder: '提耳式 / 平口式…' })}
              </div>
              {inputField(idx, 'purchase_locations', '購買地點', { placeholder: '便利商店、超市…' })}
              <label style={styles.fieldFull}>
                <span style={styles.label}>備註</span>
                <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '44px' }} rows="2"
                  value={row.notes} placeholder="尺寸、零售說明…（可留空）"
                  onChange={e => setField(idx, 'notes', e.target.value)} />
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
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldFull: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', marginTop: '12px' },
  label: { fontSize: '13px', color: '#475569', fontWeight: '600' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: '#fff' },
  rowActions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  regTag: { fontSize: '12px', color: '#94a3b8', marginRight: 'auto', fontFamily: 'monospace' },
  saveBtn: { padding: '8px 18px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  savingBtn: { backgroundColor: '#9fa8da', cursor: 'not-allowed' },
  deleteBtn: { padding: '8px 14px', backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  addBtn: { padding: '12px', width: '100%', backgroundColor: '#e8eaf6', color: '#1a237e', border: '1px dashed #9fa8da', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
};

export default BagRegulationsEditor;
