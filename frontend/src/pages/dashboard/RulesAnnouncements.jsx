import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../../utils/api';

const RulesAnnouncements = () => {
  const [activeTab, setActiveTab] = useState('announcements'); 
  const [loading, setLoading] = useState(false);

  // 📢 Tab 1：公告推播狀態
  const [announcements, setAnnouncements] = useState([]);
  const [newAnno, setNewAnno] = useState({ title: '', content: '', target_city: '全體' });

  // 📜 Tab 2：清運法規狀態
  const [selectedCity, setSelectedCity] = useState('台北市');
  const [ruleData, setRuleData] = useState({ title: '', content: '' });

  // ==========================================
  // 核心功能 1：撈取公告清單
  // ==========================================
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/announcements/list`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch {
      setAnnouncements([
        { announcement_id: 1, title: '端午節連續假期垃圾清運時間調整通知', content: '全體清潔隊端午連假期間除週日例行停收外，其餘時間正常清運。', target_city: null, is_pushed: 1, pushed_at: '2026-06-01 14:00', created_at: '2026-06-01 10:00' },
        { announcement_id: 2, title: '新北市板橋區部分點位清運因道路施工改道公告', content: '因板橋文化路施工，部分清運點將臨時前移50公尺，請市民多加注意。', target_city: '新北市', is_pushed: 0, pushed_at: null, created_at: '2026-06-02 09:30' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 核心功能 2：撈取特定城市的清運規則
  // ==========================================
  const fetchCityRule = async (city) => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/rules/get?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      if (data.content === "請在後台管理面板輸入此城市的詳細法規與預約步驟細則。") {
        setRuleData({ title: data.title, content: '' });
      } else {
        setRuleData({ title: data.title, content: data.content });
      }
    } catch {
      // API 未通前的 Mock 狀態也同步清空 content，確保畫面一律呈現漂亮的虛擬提示
      setRuleData({ title: `${city}大型廢棄物清運指南及法規`, content: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'announcements') fetchAnnouncements();
    else fetchCityRule(selectedCity);
  }, [activeTab, selectedCity]);

  // ==========================================
  // 核心功能 3：發布新公告
  // ==========================================
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnno.title || !newAnno.content) return alert('請填寫公告標題與內容');

    const triggerLinePush = window.confirm('公告即將送入資料庫！請選擇是否要同時一鍵發送 LINE Bot 訊息推播給所有訂閱市民？');

    try {
      const baseUrl = await getBackendUrl();
      await fetch(`${baseUrl}/api/announcements/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAnno, trigger_push: triggerLinePush ? 1 : 0 })
      });
      alert('發布成功！');
      fetchAnnouncements();
      setNewAnno({ title: '', content: '', target_city: '全體' });
    } catch {
      alert(`🎉 [前端模擬成功] 公告已發布！\nLINE 推播狀態：${triggerLinePush ? '📡 已調度 line_service 進行群發' : '🔕 僅存放至資料庫'}`);
      setAnnouncements([{
        announcement_id: Date.now(),
        title: newAnno.title,
        content: newAnno.content,
        target_city: newAnno.target_city === '全體' ? null : newAnno.target_city,
        is_pushed: triggerLinePush ? 1 : 0,
        pushed_at: triggerLinePush ? '剛剛' : null,
        created_at: '剛剛'
      }, ...announcements]);
      setNewAnno({ title: '', content: '', target_city: '全體' });
    }
  };

  // ==========================================
  // 核心功能 4：修改市政清運規則
  // ==========================================
  const handleUpdateRule = async () => {
    if (!ruleData.title) return alert('請填寫法規標題');
    try {
      const baseUrl = await getBackendUrl();
      const res = await fetch(`${baseUrl}/api/rules/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity, ...ruleData })
      });
      if (!res.ok) throw new Error();
      alert('儲存法規修改成功 💾');
    } catch {
      alert(`💾 [前端模擬成功] 已對 MySQL 發送 UPDATE bulky_waste_info 請求！\n成功更新 [${selectedCity}] 的法規內文。`);
    }
  };

  return (
    <div style={styles.card}>
      {/* 頂部切換 Tabs */}
      <div style={styles.tabContainer}>
        <button 
          onClick={() => setActiveTab('announcements')} 
          style={{...styles.tabButton, ...(activeTab === 'announcements' ? styles.tabActive : {})}}
        >
          📢 即時公告推播 (Announcements)
        </button>
        <button 
          onClick={() => setActiveTab('rules')} 
          style={{...styles.tabButton, ...(activeTab === 'rules' ? styles.tabActive : {})}}
        >
          📜 清運法規與大型垃圾指南 (Rules)
        </button>
      </div>

      {loading && <div style={styles.loadingText}>⏳ 正在調度 MySQL 資料庫數據...</div>}

      {/* ─── TAB 1：即時公告推播頁面 ─── */}
      {!loading && activeTab === 'announcements' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <h3 style={styles.panelTitle}>✍️ 發布新公告</h3>
            <form onSubmit={handleCreateAnnouncement} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>公告主題</label>
                <input 
                  type="text" 
                  value={newAnno.title} 
                  onChange={(e) => setNewAnno({...newAnno, title: e.target.value})}
                  placeholder="請輸入公告主題（例如：颱風天停收通知）" 
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>目標縣市受眾</label>
                <select 
                  value={newAnno.target_city} 
                  onChange={(e) => setNewAnno({...newAnno, target_city: e.target.value})}
                  style={styles.select}
                >
                  <option value="全體">🌍 全體縣市（台北/新北/基隆）</option>
                  <option value="台北市">🔵 台北市市民</option>
                  <option value="新北市">🟢 新北市市民</option>
                  <option value="基隆市">🟡 基隆市市民</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>詳細公告內文</label>
                <textarea 
                  rows="6" 
                  value={newAnno.content}
                  onChange={(e) => setNewAnno({...newAnno, content: e.target.value})}
                  placeholder="請輸入詳細的變更通知內文..." 
                  style={styles.textarea}
                />
              </div>

              <button type="submit" style={styles.submitBtn}>🚀 確定發布（可選擇群發 LINE）</button>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📂 歷史公告發布存檔紀錄</h3>
            <div style={styles.timeline}>
              {announcements.map((anno) => (
                <div key={anno.announcement_id} style={styles.timelineCard}>
                  <div style={styles.timelineHeader}>
                    <span style={styles.scopeBadge}>
                      {anno.target_city ? `📍 ${anno.target_city}` : '🌍 全體縣市'}
                    </span>
                    <span style={styles.timeText}>{anno.created_at}</span>
                  </div>
                  <h4 style={styles.annoTitle}>{anno.title}</h4>
                  <p style={styles.annoContent}>{anno.content}</p>
                  <div style={styles.pushFooter}>
                    {anno.is_pushed ? (
                      <span style={styles.pushedTag}>📡 LINE 官方已推播通報 ({anno.pushed_at})</span>
                    ) : (
                      <span style={styles.unpushedTag}>🔕 僅存放於後台系統，未發送推播</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2：市政法規與巨大垃圾清運指南 ─── */}
      {!loading && activeTab === 'rules' && (
        <div style={styles.rulesContainer}>
          <div style={styles.citySelectorRow}>
            <span style={{fontWeight: 'bold', fontSize: '15px'}}>🏢 當前選定維護城市：</span>
            {['台北市', '新北市', '基隆市'].map((city) => (
              <button 
                key={city}
                onClick={() => setSelectedCity(city)}
                style={{...styles.cityTabBtn, ...(selectedCity === city ? styles.cityTabActive : {})}}
              >
                {city}
              </button>
            ))}
          </div>

          <div style={styles.ruleEditorCard}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>清運法規標題</label>
              <input 
                type="text" 
                value={ruleData.title}
                onChange={(e) => setRuleData({ ...ruleData, title: e.target.value })}
                style={styles.input}
              />
            </div>

            {/* 🟢 終極修正：合併樣式物件，將 label 優雅擺在對話框正上方，並給予 20px 上間距 */}
            <div style={{ ...styles.inputGroup, marginTop: '20px' }}>
              <label style={styles.label}>大型垃圾清運細則與步驟指南（支援多行自由格式）</label>
              <textarea 
                rows="12" 
                value={ruleData.content}
                onChange={(e) => setRuleData({ ...ruleData, content: e.target.value })}
                placeholder="請輸入此城市的詳細法規與預約步驟細則...&#10;（例如：&#10;1. 撥打環境保護局各區清潔隊電話預約時間。&#10;2. 將大型廢棄物移置自家門前或巷口指定處。&#10;3. 清潔隊依約定時間派車前往免費清運。）"
                style={styles.textarea}
              />
            </div>

            <div style={{textAlign: 'right', marginTop: '20px'}}>
              <button onClick={handleUpdateRule} style={styles.saveBtn}>💾 儲存並更新資料庫 `bulky_waste_info`</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' },
  tabContainer: { display: 'flex', gap: '5px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' },
  tabButton: { padding: '12px 20px', border: 'none', background: 'none', fontSize: '15px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', transition: 'all 0.2s' },
  tabActive: { color: '#1a237e', backgroundColor: '#e8eaf6', borderBottom: '3px solid #1a237e' },
  loadingText: { textAlign: 'center', padding: '15px', color: '#64748b' },
  gridContainer: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  formPanel: { flex: '1', minWidth: '320px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  listPanel: { flex: '1.2', minWidth: '350px' },
  panelTitle: { margin: '0 0 15px 0', color: '#334155', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }, // 🟢 確保寬度吃滿 100%
  label: { fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }, // 🟢 優化標題字體與底邊距
  input: { padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff', width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', lineHeight: '1.6' }, // 🟢 強制對話框拉寬到 100%
  submitBtn: { padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '550px', overflowY: 'auto', paddingRight: '5px' },
  timelineCard: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  timelineHeader: { display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  scopeBadge: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' },
  timeText: { fontSize: '12px', color: '#94a3b8' },
  annoTitle: { margin: '0 0 6px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold' },
  annoContent: { margin: '0 0 10px 0', fontSize: '14px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  pushedTag: { fontSize: '12px', color: '#16a34a', fontWeight: 'bold' },
  unpushedTag: { fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' },
  citySelectorRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  cityTabBtn: { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '20px', backgroundColor: '#fff', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' },
  cityTabActive: { backgroundColor: '#0284c7', color: 'white', borderColor: '#0284c7' },
  ruleEditorCard: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', backgroundColor: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
  saveBtn: { padding: '12px 24px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }
};

export default RulesAnnouncements;