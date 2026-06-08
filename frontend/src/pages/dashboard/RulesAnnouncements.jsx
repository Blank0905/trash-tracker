import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';
import BagRegulationsEditor from './BagRegulationsEditor';

const c = theme.colors;
const r = theme.radius;

// 後台法規即時預覽：Markdown→HTML 並消毒（breaks=true 與 LIFF 顯示一致）
marked.setOptions({ breaks: true, gfm: true });
const mdToSafeHtml = (text) => DOMPurify.sanitize(marked.parse(String(text ?? '')));

const RulesAnnouncements = () => {
  const [activeTab, setActiveTab] = useState('announcements'); 
  const [loading, setLoading] = useState(false);

  // 📢 Tab 1：公告推播狀態
  const [announcements, setAnnouncements] = useState([]);
  const [newAnno, setNewAnno] = useState({ title: '', content: '', target_city: '全體' });
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);
  
  // 🟢 新增：用來記錄目前正在「重新編輯」哪一則歷史公告的 ID（Null 代表新建公告）
  const [editingId, setEditingId] = useState(null);

  // 📜 Tab 2：清運法規狀態
  const [selectedCity, setSelectedCity] = useState('台北市');
  const [ruleData, setRuleData] = useState({ title: '', content: '' });

  // 目前登入管理員的 user_id（登入時存於 localStorage，見 Login.jsx），作為公告 created_by；未登入則為 null
  const currentAdminId = localStorage.getItem('admin_id');

  const formatDisplayTime = (rawValue) => {
    if (rawValue == null) return '';
    const raw = String(rawValue).trim();
    if (!raw) return '';
    if (raw === '剛剛') return raw;

    // 防呆：後端若誤回傳 DATE_FORMAT 模板字串，不直接顯示給使用者
    if (raw.includes('%Y') || raw.includes('%m') || raw.includes('%d') || raw.includes('%H') || raw.includes('%i')) {
      return '時間格式錯誤';
    }

    const parsed = new Date(raw.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return raw;

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hour = String(parsed.getHours()).padStart(2, '0');
    const minute = String(parsed.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  // ==========================================
  // 核心功能 1：撈取公告清單
  // ==========================================
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/announcements/list`);
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

  const normalizeAnnouncementForForm = (announcement) => ({
    title: announcement?.title || '',
    content: announcement?.content || '',
    target_city: announcement?.target_city || '全體'
  });

  const handleApplyAnnouncement = async (announcement) => {
    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/announcements/template/${announcement.announcement_id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const source = data?.announcement || announcement;
      setEditingId(null);
      setNewAnno(normalizeAnnouncementForForm(source));
    } catch {
      setEditingId(null);
      setNewAnno(normalizeAnnouncementForForm(announcement));
    }
  };

  const handleViewAnnouncement = async (announcement) => {
    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/announcements/template/${announcement.announcement_id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setViewingAnnouncement(data?.announcement || announcement);
    } catch {
      setViewingAnnouncement(announcement);
    }
  };

  // ==========================================
  // 核心功能 2：撈取特定城市的清運規則
  // ==========================================
  const fetchCityRule = async (city) => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/rules/get?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      if (data.content === "請在後台管理面板輸入此城市的詳細法規與預約步驟細則。") {
        setRuleData({ title: data.title, content: '' });
      } else {
        setRuleData({ title: data.title, content: data.content });
      }
    } catch {
      setRuleData({ title: `${city}大型廢棄物清運指南及法規`, content: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'announcements') fetchAnnouncements();
    else if (activeTab === 'rules') fetchCityRule(selectedCity);
    // 'bags' 分頁由 BagRegulationsEditor 自行載入，這裡不處理
  }, [activeTab, selectedCity]);

  // ==========================================
  // 核心功能 3：發布新公告（或儲存修改公告）
  // ==========================================
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnno.title || !newAnno.content) return alert('請填寫公告標題與內容');

    const baseUrl = await getBackendUrl();

    // 情況 A：如果目前處於「重新編輯」模式
    if (editingId) {
      try {
        const response = await authedFetch(`${baseUrl}/api/announcements/update/${editingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAnno)
        });
        if (!response.ok) throw new Error();
        alert('公告修改成功！');
        setEditingId(null);
        fetchAnnouncements();
        setNewAnno({ title: '', content: '', target_city: '全體' });
      } catch {
        alert('💾 [前端模擬成功] 未發布公告之修改已儲存！');
        setAnnouncements(prev => prev.map(anno => 
          anno.announcement_id === editingId 
            ? { ...anno, title: newAnno.title, content: newAnno.content, target_city: newAnno.target_city === '全體' ? null : newAnno.target_city }
            : anno
        ));
        setEditingId(null);
        setNewAnno({ title: '', content: '', target_city: '全體' });
      }
      return;
    }

    // ⚪ 情況 B：原本的「發布全新公告」邏輯
    const triggerLinePush = window.confirm('公告即將送入資料庫！請選擇是否要同時一鍵發送 LINE Bot 訊息推播給所有訂閱市民？');
    const currentAdminId = localStorage.getItem('admin_id');

    try {
      const response = await authedFetch(`${baseUrl}/api/announcements/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...newAnno, 
          trigger_push: triggerLinePush ? 1 : 0,
          // 🟢 這樣 currentAdminId 才有定義，不會再拋出 ReferenceError 了
          created_by: currentAdminId ? parseInt(currentAdminId, 10) : null 
        })
      });

      if (!response.ok) throw new Error('後端服務異常');

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
  //  新增功能：針對未推播歷史公告進行「直接發送」
  // ==========================================
  const handleResendPush = async (annoId) => {
    const confirmPush = window.confirm('確定要將這則歷史公告一鍵群發給所有 LINE 訂閱市民嗎？');
    if (!confirmPush) return;

    try {
      const baseUrl = await getBackendUrl();
      const response = await authedFetch(`${baseUrl}/api/announcements/push/${annoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '補發失敗');
      }

      alert('📡 LINE 推播成功補發！');
      fetchAnnouncements();
    } catch (err) {
      // 補發推播的前端 Mock 模擬
      alert(`🎉 [前端模擬成功] LINE 推播已成功補發！`);
      setAnnouncements(prev => prev.map(anno => 
        anno.announcement_id === annoId 
          ? { ...anno, is_pushed: 1, pushed_at: '剛剛' } 
          : anno
      ));
    }
  };

  // ==========================================
  // 核心功能 4：修改市政清運規則
  // ==========================================
  const handleUpdateRule = async () => {
    if (!ruleData.title) return alert('請填寫法規標題');
    try {
      const baseUrl = await getBackendUrl();
      const res = await authedFetch(`${baseUrl}/api/rules/update`, {
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
          onClick={() => { setActiveTab('announcements'); setEditingId(null); setNewAnno({ title: '', content: '', target_city: '全體' }); }} 
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
        <button
          onClick={() => setActiveTab('bags')}
          style={{...styles.tabButton, ...(activeTab === 'bags' ? styles.tabActive : {})}}
        >
          🛍 垃圾袋規範 (Bags)
        </button>
      </div>

      {loading && <div style={styles.loadingText}>⏳ 正在調度 MySQL 資料庫數據...</div>}

      {/* ─── TAB 1：即時公告推播頁面 ─── */}
      {!loading && activeTab === 'announcements' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            {/* 🟢 動態切換表單標題 */}
            <h3 style={styles.panelTitle}>{editingId ? '✏️ 重新編輯未發布公告' : '✍️ 發布新公告'}</h3>
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

              {/* 🟢 動態調整按鈕區域，並在編輯模式下多增加一個取消按鈕 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ ...styles.submitBtn, flex: 1, backgroundColor: editingId ? '#0284c7' : '#1a237e' }}>
                  {editingId ? '💾 儲存修改' : '🚀 確定發布（可選擇群發 LINE）'}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={() => { setEditingId(null); setNewAnno({ title: '', content: '', target_city: '全體' }); }} 
                    style={{ ...styles.submitBtn, backgroundColor: '#94a3b8' }}
                  >
                    取消編輯
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📂 歷史公告發布存檔紀錄</h3>
            <div style={styles.timeline}>
              {announcements.map((anno) => (
                <div key={anno.announcement_id} style={{ ...styles.timelineCard, border: editingId === anno.announcement_id ? '2px solid #0284c7' : '1px solid #e2e8f0' }}>
                  <div style={styles.timelineHeader}>
                    <span style={styles.scopeBadge}>
                      {anno.target_city ? `📍 ${anno.target_city}` : '🌍 全體縣市'}
                    </span>
                    <span style={styles.timeText}>{formatDisplayTime(anno.created_at)}</span>
                  </div>
                  <h4 style={styles.annoTitle}>{anno.title}</h4>
                  <p style={styles.annoContent}>{anno.content}</p>
                  <div style={styles.pushFooter}>
                    {anno.is_pushed ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={styles.pushedTag}>
                          📡 LINE 官方已推播通報
                          {formatDisplayTime(anno.pushed_at) ? ` (${formatDisplayTime(anno.pushed_at)})` : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleViewAnnouncement(anno)}
                            style={{ ...styles.secondaryBtn, backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                          >
                            👁️ 檢視
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAnnouncement(anno)}
                            style={{ ...styles.secondaryBtn, backgroundColor: '#ecfccb', color: '#3f6212', borderColor: '#bef264' }}
                          >
                            套用到左側表單
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 🟢 修改點：未推播的公告，優雅加入「編輯」與「直接發送」兩顆功能按鈕 */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={styles.unpushedTag}>🔕 僅存放於後台系統，未發送推播</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(anno.announcement_id);
                              setNewAnno({ title: anno.title, content: anno.content, target_city: anno.target_city || '全體' });
                            }}
                            style={{ padding: '5px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            ✏️ 點選編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewAnnouncement(anno)}
                            style={{ ...styles.secondaryBtn, backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                          >
                            👁️ 檢視
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAnnouncement(anno)}
                            style={{ ...styles.secondaryBtn, backgroundColor: '#ecfccb', color: '#3f6212', borderColor: '#bef264' }}
                          >
                            套用
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResendPush(anno.announcement_id)}
                            style={{ padding: '5px 12px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            🚀 直接發送 LINE 推播
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewingAnnouncement && (
        <div style={styles.modalOverlay} onClick={() => setViewingAnnouncement(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>歷史公告檢視</h3>
              <button
                type="button"
                onClick={() => setViewingAnnouncement(null)}
                style={styles.modalCloseBtn}
              >
                關閉
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={styles.scopeBadge}>
                {viewingAnnouncement.target_city ? `📍 ${viewingAnnouncement.target_city}` : '🌍 全體縣市'}
              </span>
              <span style={styles.timeText}>建立時間：{formatDisplayTime(viewingAnnouncement.created_at) || '未提供'}</span>
              {viewingAnnouncement.is_pushed ? (
                <span style={styles.pushedTag}>已推播</span>
              ) : (
                <span style={styles.unpushedTag}>未推播</span>
              )}
            </div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '17px', color: '#1e293b' }}>{viewingAnnouncement.title}</h4>
            <div style={styles.modalContent}>{viewingAnnouncement.content}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  handleApplyAnnouncement(viewingAnnouncement);
                  setViewingAnnouncement(null);
                }}
                style={{ ...styles.submitBtn, backgroundColor: '#16a34a' }}
              >
                套用到左側表單
              </button>
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

            <div style={{ ...styles.inputGroup, marginTop: '20px' }}>
              <label style={styles.label}>
                大型垃圾清運細則與步驟指南
                <span style={{ fontWeight: 'normal', color: '#94a3b8', marginLeft: '8px', fontSize: '12px' }}>
                  支援 Markdown：**粗體**、- 清單、[文字](https://網址)
                </span>
              </label>
              <textarea
                rows="12"
                value={ruleData.content}
                onChange={(e) => setRuleData({ ...ruleData, content: e.target.value })}
                placeholder="請輸入此城市的詳細法規與預約步驟細則...&#10;（例如：&#10;1. 撥打環境保護局各區清潔隊電話預約時間。&#10;2. 將大型廢棄物移置自家門前或巷口指定處。&#10;3. 清潔隊依約定時間派車前往免費清運。）"
                style={styles.textarea}
              />
            </div>

            <div style={{ ...styles.inputGroup, marginTop: '16px' }}>
              <label style={styles.label}>📄 即時預覽（與市民端 LIFF 顯示一致）</label>
              <div
                style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#fff', minHeight: '60px', lineHeight: 1.7, fontSize: '14px', color: '#334155', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: mdToSafeHtml(ruleData.content) || '<span style="color:#94a3b8">（預覽會顯示在這裡）</span>' }}
              />
            </div>

            <div style={{textAlign: 'right', marginTop: '20px'}}>
              <button onClick={handleUpdateRule} style={styles.saveBtn}>💾 儲存並更新資料庫 `bulky_waste_info`</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3：垃圾袋規範（多列 CRUD，元件自行載入） ─── */}
      {!loading && activeTab === 'bags' && <BagRegulationsEditor />}
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: c.surface1, borderRadius: r.lg,
    border: `1px solid ${c.border}`, padding: '24px',
    fontFamily: theme.fonts.sans,
  },
  // Tab bar：細底線 + indigo active
  tabContainer: {
    display: 'flex', gap: '0', borderBottom: `1px solid ${c.border}`,
    marginBottom: '22px', flexWrap: 'wrap',
  },
  tabButton: {
    padding: '10px 16px', border: 'none', background: 'none',
    fontSize: '13.5px', fontWeight: '500', color: c.textDim, cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: '-1px',
    transition: `color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
  },
  tabActive: { color: c.brand, fontWeight: '600', borderBottomColor: c.brand },
  loadingText: { textAlign: 'center', padding: '15px', color: c.textMuted, fontSize: '13px' },
  // 左右雙欄：左為表單、右為時間軸
  gridContainer: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  formPanel: {
    flex: '1', minWidth: '320px',
    backgroundColor: c.surface2,
    padding: '20px', borderRadius: r.md,
    border: `1px solid ${c.border}`,
  },
  listPanel: { flex: '1.2', minWidth: '350px' },
  panelTitle: {
    margin: '0 0 14px 0', color: c.text, fontSize: '14px', fontWeight: '600',
    borderBottom: `1px solid ${c.border}`, paddingBottom: '10px',
    letterSpacing: '-0.005em',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' },
  // 小 micro label（uppercase）
  label: {
    fontSize: '11px', color: c.textMuted, fontWeight: '600',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: '2px',
  },
  input: {
    padding: '9px 12px', borderRadius: r.md,
    border: `1px solid ${c.border}`, backgroundColor: c.surface1,
    color: c.text, fontSize: '13px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    fontFamily: theme.fonts.sans,
    transition: `border-color ${theme.transition.fast}`,
  },
  select: {
    padding: '9px 12px', borderRadius: r.md,
    border: `1px solid ${c.border}`, backgroundColor: c.surface1,
    color: c.text, fontSize: '13px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    fontFamily: theme.fonts.sans, cursor: 'pointer',
  },
  textarea: {
    padding: '12px', borderRadius: r.md,
    border: `1px solid ${c.border}`, backgroundColor: c.surface1,
    color: c.text, fontSize: '13px', outline: 'none', resize: 'vertical',
    width: '100%', boxSizing: 'border-box',
    fontFamily: theme.fonts.mono, lineHeight: '1.6',
    transition: `border-color ${theme.transition.fast}`,
  },
  submitBtn: {
    padding: '10px', backgroundColor: c.brand, color: 'white',
    border: `1px solid ${c.brand}`, borderRadius: r.md,
    fontWeight: '600', cursor: 'pointer', fontSize: '13px',
    transition: 'background-color 0.15s ease',
    fontFamily: theme.fonts.sans,
    boxShadow: theme.shadow.brand,
  },
  timeline: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    maxHeight: '550px', overflowY: 'auto', paddingRight: '4px',
  },
  timelineCard: {
    backgroundColor: c.surface1,
    border: `1px solid ${c.border}`, borderRadius: r.md,
    padding: '14px',
  },
  timelineHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '8px',
  },
  scopeBadge: {
    backgroundColor: c.surface2, color: c.textDim,
    fontSize: '11px', padding: '2px 8px', borderRadius: r.sm,
    fontWeight: '600', letterSpacing: '0.01em',
    fontFamily: theme.fonts.sans,
  },
  timeText: { fontSize: '11.5px', color: c.textMuted, fontFamily: theme.fonts.mono, letterSpacing: '0.01em' },
  annoTitle: {
    margin: '0 0 6px 0', fontSize: '14px', color: c.text,
    fontWeight: '600', letterSpacing: '-0.005em',
  },
  annoContent: {
    margin: '0 0 10px 0', fontSize: '13px', color: c.textDim,
    lineHeight: '1.55', whiteSpace: 'pre-wrap',
  },
  pushedTag: { fontSize: '11.5px', color: c.green, fontWeight: '600' },
  unpushedTag: { fontSize: '11.5px', color: c.textMuted, fontStyle: 'italic' },
  secondaryBtn: {
    padding: '5px 11px',
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1, color: c.textDim,
    borderRadius: r.sm,
    cursor: 'pointer', fontSize: '11.5px', fontWeight: '500',
    fontFamily: theme.fonts.sans,
    transition: `background ${theme.transition.fast}`,
  },
  // 城市切換列：用 segmented control 風（並排藥丸）
  citySelectorRow: {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginBottom: '18px', flexWrap: 'wrap',
  },
  cityTabBtn: {
    padding: '7px 14px',
    border: `1px solid ${c.border}`, borderRadius: r.pill,
    backgroundColor: c.surface1, color: c.textDim,
    fontWeight: '500', cursor: 'pointer', fontSize: '12.5px',
    transition: `background ${theme.transition.fast}, border-color ${theme.transition.fast}, color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
  },
  // 城市選中用 indigo brand
  cityTabActive: {
    backgroundColor: c.brand, color: 'white', borderColor: c.brand,
    fontWeight: '600',
  },
  ruleEditorCard: {
    border: `1px solid ${c.border}`, borderRadius: r.md,
    padding: '20px', backgroundColor: c.surface1,
  },
  saveBtn: {
    padding: '10px 20px', backgroundColor: c.brand, color: 'white',
    border: `1px solid ${c.brand}`, borderRadius: r.md,
    fontWeight: '600', cursor: 'pointer', fontSize: '13px',
    fontFamily: theme.fonts.sans, boxShadow: theme.shadow.brand,
  },
  modalOverlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', zIndex: 1000,
  },
  modalCard: {
    width: 'min(680px, 100%)', maxHeight: '80vh', overflowY: 'auto',
    backgroundColor: c.surface1, borderRadius: r.lg,
    border: `1px solid ${c.border}`, padding: '22px',
    boxShadow: theme.shadow.lg,
    fontFamily: theme.fonts.sans,
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', marginBottom: '14px',
  },
  modalCloseBtn: {
    padding: '6px 12px', borderRadius: r.sm,
    border: `1px solid ${c.border}`, backgroundColor: c.surface1,
    color: c.textDim, cursor: 'pointer', fontWeight: '500', fontSize: '12.5px',
    fontFamily: theme.fonts.sans,
  },
  modalContent: {
    border: `1px solid ${c.border}`, borderRadius: r.md,
    backgroundColor: c.surface2, padding: '14px',
    color: c.text, fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap',
  },
};

export default RulesAnnouncements;
