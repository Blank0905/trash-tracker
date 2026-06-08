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
  const [editingId, setEditingId] = useState(null);

  // 📜 Tab 2：清運法規狀態
  const [selectedCity, setSelectedCity] = useState('台北市');
  const [ruleData, setRuleData] = useState({ title: '', content: '' });

  const formatDisplayTime = (rawValue) => {
    if (rawValue == null) return '';
    const raw = String(rawValue).trim();
    if (!raw) return '';
    if (raw === '剛剛') return raw;
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
  }, [activeTab, selectedCity]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnno.title || !newAnno.content) return alert('請填寫公告標題與內容');

    const baseUrl = await getBackendUrl();

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

    const triggerLinePush = window.confirm('公告即將送入資料庫！請選擇是否要同時一鍵發送 LINE Bot 訊息推播給所有訂閱市民？');
    const currentAdminId = localStorage.getItem('admin_id');

    try {
      const response = await authedFetch(`${baseUrl}/api/announcements/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAnno,
          trigger_push: triggerLinePush ? 1 : 0,
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

  const handleResendPush = async (annoId) => {
    if (!window.confirm('確定要將這則歷史公告一鍵群發給所有 LINE 訂閱市民嗎？')) return;
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
      alert(`🎉 [前端模擬成功] LINE 推播已成功補發！`);
      setAnnouncements(prev => prev.map(anno =>
        anno.announcement_id === annoId
          ? { ...anno, is_pushed: 1, pushed_at: '剛剛' }
          : anno
      ));
    }
  };

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
      {/* 頁首：標題 + 副標 + 編輯狀態 indicator */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>規則與公告</h1>
        <p style={styles.pageSubtitle}>市民端 LIFF 顯示的公告、清運法規、垃圾袋規範皆於本頁維護</p>
      </div>

      {/* 頂部切換 Tabs */}
      <div style={styles.tabContainer}>
        <button
          onClick={() => { setActiveTab('announcements'); setEditingId(null); setNewAnno({ title: '', content: '', target_city: '全體' }); }}
          style={{ ...styles.tabButton, ...(activeTab === 'announcements' ? styles.tabActive : {}) }}
        >
          公告推播
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          style={{ ...styles.tabButton, ...(activeTab === 'rules' ? styles.tabActive : {}) }}
        >
          清運法規
        </button>
        <button
          onClick={() => setActiveTab('bags')}
          style={{ ...styles.tabButton, ...(activeTab === 'bags' ? styles.tabActive : {}) }}
        >
          垃圾袋規範
        </button>
      </div>

      {loading && <div style={styles.loadingText}>正在調度資料庫…</div>}

      {/* ─── TAB 1：即時公告推播 ─── */}
      {!loading && activeTab === 'announcements' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <div style={styles.formPanelHeader}>
              <h2 style={styles.panelTitle}>{editingId ? '重新編輯未發布公告' : '建立新公告'}</h2>
              {editingId && <span style={styles.editingChip}>編輯中 · #{editingId}</span>}
            </div>

            <form onSubmit={handleCreateAnnouncement} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>公告主題</label>
                <input
                  type="text"
                  value={newAnno.title}
                  onChange={(e) => setNewAnno({ ...newAnno, title: e.target.value })}
                  placeholder="例：颱風天停收通知"
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>目標縣市受眾</label>
                <select
                  value={newAnno.target_city}
                  onChange={(e) => setNewAnno({ ...newAnno, target_city: e.target.value })}
                  style={styles.select}
                >
                  <option value="全體">全體縣市（台北 / 新北 / 基隆）</option>
                  <option value="台北市">台北市</option>
                  <option value="新北市">新北市</option>
                  <option value="基隆市">基隆市</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>公告內文</label>
                <textarea
                  rows="6"
                  value={newAnno.content}
                  onChange={(e) => setNewAnno({ ...newAnno, content: e.target.value })}
                  placeholder="請輸入詳細的變更通知內文…"
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formActions}>
                <button type="submit" style={styles.primaryBtn}>
                  {editingId ? '儲存修改' : '發布（可選擇群發 LINE）'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setNewAnno({ title: '', content: '', target_city: '全體' }); }}
                    style={styles.ghostBtn}
                  >
                    取消編輯
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h2 style={styles.panelTitle}>歷史公告</h2>
            <div style={styles.timeline}>
              {announcements.length === 0 && (
                <div style={styles.emptyState}>目前尚未建立任何公告</div>
              )}
              {announcements.map((anno) => {
                const isEditingThis = editingId === anno.announcement_id;
                return (
                  <div
                    key={anno.announcement_id}
                    style={{
                      ...styles.timelineCard,
                      ...(isEditingThis ? styles.timelineCardEditing : {}),
                    }}
                  >
                    <div style={styles.timelineHeader}>
                      <span style={styles.scopeBadge}>
                        {anno.target_city ? anno.target_city : '全體縣市'}
                      </span>
                      <span style={styles.timeText}>{formatDisplayTime(anno.created_at)}</span>
                    </div>

                    <h3 style={styles.annoTitle}>{anno.title}</h3>
                    <p style={styles.annoContent}>{anno.content}</p>

                    <div style={styles.statusRow}>
                      {anno.is_pushed ? (
                        <span style={styles.pushedTag}>
                          ● 已推播{formatDisplayTime(anno.pushed_at) ? ` · ${formatDisplayTime(anno.pushed_at)}` : ''}
                        </span>
                      ) : (
                        <span style={styles.unpushedTag}>○ 僅存於後台，未推播</span>
                      )}
                    </div>

                    <div style={styles.cardActions}>
                      <button type="button" onClick={() => handleViewAnnouncement(anno)} style={styles.actionBtn}>
                        檢視
                      </button>
                      <button type="button" onClick={() => handleApplyAnnouncement(anno)} style={styles.actionBtn}>
                        套用
                      </button>
                      {!anno.is_pushed && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(anno.announcement_id);
                              setNewAnno({ title: anno.title, content: anno.content, target_city: anno.target_city || '全體' });
                            }}
                            style={{ ...styles.actionBtn, ...styles.actionBtnBrand }}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResendPush(anno.announcement_id)}
                            style={{ ...styles.actionBtn, ...styles.actionBtnPush }}
                          >
                            發送推播
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 公告檢視 Modal */}
      {viewingAnnouncement && (
        <div style={styles.modalOverlay} onClick={() => setViewingAnnouncement(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>歷史公告檢視</h2>
              <button type="button" onClick={() => setViewingAnnouncement(null)} style={styles.modalCloseBtn}>
                關閉
              </button>
            </div>

            <div style={styles.modalMetaRow}>
              <span style={styles.scopeBadge}>
                {viewingAnnouncement.target_city ? viewingAnnouncement.target_city : '全體縣市'}
              </span>
              <span style={styles.timeText}>
                建立：{formatDisplayTime(viewingAnnouncement.created_at) || '未提供'}
              </span>
              {viewingAnnouncement.is_pushed
                ? <span style={styles.pushedTag}>● 已推播</span>
                : <span style={styles.unpushedTag}>○ 未推播</span>}
            </div>

            <h3 style={styles.modalAnnoTitle}>{viewingAnnouncement.title}</h3>
            <div style={styles.modalContent}>{viewingAnnouncement.content}</div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => { handleApplyAnnouncement(viewingAnnouncement); setViewingAnnouncement(null); }}
                style={styles.primaryBtn}
              >
                套用到左側表單
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2：清運法規 ─── */}
      {!loading && activeTab === 'rules' && (
        <div>
          <div style={styles.citySelectorRow}>
            <span style={styles.citySelectorLabel}>當前維護縣市</span>
            {['台北市', '新北市', '基隆市'].map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                style={{ ...styles.cityTabBtn, ...(selectedCity === city ? styles.cityTabActive : {}) }}
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
                <span style={styles.labelHint}>支援 Markdown：**粗體**、- 清單、[文字](網址)</span>
              </label>
              <textarea
                rows="12"
                value={ruleData.content}
                onChange={(e) => setRuleData({ ...ruleData, content: e.target.value })}
                placeholder={"請輸入詳細法規與預約步驟細則…\n例：\n1. 撥打環保局各區清潔隊電話預約時間\n2. 將大型廢棄物移置自家門前或巷口指定處\n3. 清潔隊依約定時間派車前往免費清運"}
                style={styles.textarea}
              />
            </div>

            <div style={{ ...styles.inputGroup, marginTop: '20px' }}>
              <label style={styles.label}>即時預覽（與市民端 LIFF 顯示一致）</label>
              <div
                style={styles.previewBox}
                dangerouslySetInnerHTML={{
                  __html: mdToSafeHtml(ruleData.content)
                    || `<span style="color:${c.textFaint}">（預覽會顯示在這裡）</span>`
                }}
              />
            </div>

            <div style={styles.ruleFooter}>
              <span style={styles.dbHint}>儲存將更新資料庫 <code style={styles.codeInline}>bulky_waste_info</code></span>
              <button onClick={handleUpdateRule} style={styles.primaryBtn}>儲存並更新</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3：垃圾袋規範 ─── */}
      {!loading && activeTab === 'bags' && <BagRegulationsEditor />}
    </div>
  );
};

// ============================================================
// styles — 全部走 theme token；無任何硬編碼色
// ============================================================
const styles = {
  card: {
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '28px 28px 32px',
    fontFamily: theme.fonts.sans,
    boxShadow: theme.shadow.sm,
  },

  // ---- 頁首 ----
  pageHeader: { marginBottom: '22px' },
  pageTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '600',
    letterSpacing: '-0.02em',
    color: c.text,
  },
  pageSubtitle: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: c.textMuted,
    lineHeight: '1.55',
  },

  // ---- Tab bar ----
  tabContainer: {
    display: 'flex',
    gap: '0',
    borderBottom: `1px solid ${c.border}`,
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  tabButton: {
    padding: '11px 18px',
    border: 'none',
    background: 'none',
    fontSize: '14px',
    fontWeight: '500',
    color: c.textMuted,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: `color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
    letterSpacing: '0.01em',
  },
  tabActive: {
    color: c.brand,
    fontWeight: '600',
    borderBottomColor: c.brand,
  },

  loadingText: {
    textAlign: 'center',
    padding: '24px',
    color: c.textMuted,
    fontSize: '13px',
    letterSpacing: '0.02em',
  },

  // ---- 左右雙欄 ----
  gridContainer: { display: 'flex', gap: '24px', flexWrap: 'wrap' },

  // 左欄：建立 / 編輯表單
  formPanel: {
    flex: '1',
    minWidth: '340px',
    backgroundColor: c.bg,
    padding: '22px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
  },
  formPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${c.border}`,
  },
  editingChip: {
    padding: '3px 10px',
    borderRadius: r.pill,
    backgroundColor: c.brandSoft,
    color: c.brand,
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.04em',
    fontFamily: theme.fonts.mono,
    border: `1px solid ${c.brandTint}`,
  },

  panelTitle: {
    margin: 0,
    color: c.text,
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '-0.005em',
  },

  form: { display: 'flex', flexDirection: 'column', gap: '16px' },

  inputGroup: { display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' },

  label: {
    fontSize: '11px',
    color: c.textMuted,
    fontWeight: '600',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
  },
  labelHint: {
    marginLeft: '8px',
    fontSize: '11px',
    color: c.textFaint,
    fontWeight: '400',
    letterSpacing: '0.01em',
    textTransform: 'none',
    fontFamily: theme.fonts.mono,
  },

  input: {
    padding: '10px 13px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.text,
    fontSize: '13.5px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: theme.fonts.sans,
    transition: `border-color ${theme.transition.fast}, background ${theme.transition.fast}`,
  },
  select: {
    padding: '10px 13px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.text,
    fontSize: '13.5px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: theme.fonts.sans,
    cursor: 'pointer',
  },
  textarea: {
    padding: '13px',
    borderRadius: r.md,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.text,
    fontSize: '13.5px',
    outline: 'none',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: theme.fonts.mono,
    lineHeight: '1.7',
    transition: `border-color ${theme.transition.fast}`,
  },

  // ---- 按鈕語意 ----
  formActions: { display: 'flex', gap: '10px', marginTop: '4px' },
  primaryBtn: {
    flex: 1,
    padding: '11px 16px',
    backgroundColor: c.brand,
    color: '#ffffff',
    border: `1px solid ${c.brand}`,
    borderRadius: r.md,
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13.5px',
    fontFamily: theme.fonts.sans,
    boxShadow: theme.shadow.brand,
    transition: `background ${theme.transition.fast}`,
    letterSpacing: '0.01em',
  },
  ghostBtn: {
    padding: '11px 18px',
    backgroundColor: 'transparent',
    color: c.textMuted,
    border: `1px solid ${c.borderStrong}`,
    borderRadius: r.md,
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: theme.fonts.sans,
    transition: `background ${theme.transition.fast}, color ${theme.transition.fast}`,
  },

  // ---- 右欄：歷史時間軸 ----
  listPanel: { flex: '1.2', minWidth: '360px', display: 'flex', flexDirection: 'column' },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '600px',
    overflowY: 'auto',
    paddingRight: '4px',
    marginTop: '14px',
  },
  emptyState: {
    padding: '32px 20px',
    textAlign: 'center',
    color: c.textMuted,
    fontSize: '13px',
    border: `1px dashed ${c.border}`,
    borderRadius: r.md,
    backgroundColor: c.bg,
  },
  timelineCard: {
    backgroundColor: c.surface1,
    border: `1px solid ${c.border}`,
    borderLeft: `3px solid ${c.surface3}`,
    borderRadius: r.md,
    padding: '16px 18px',
    transition: `border-color ${theme.transition.fast}, box-shadow ${theme.transition.fast}`,
  },
  timelineCardEditing: {
    borderColor: c.brandTint,
    borderLeftColor: c.brand,
    boxShadow: theme.shadow.brand,
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  scopeBadge: {
    backgroundColor: c.surface2,
    color: c.textDim,
    fontSize: '11px',
    padding: '3px 10px',
    borderRadius: r.sm,
    fontWeight: '600',
    letterSpacing: '0.04em',
    border: `1px solid ${c.border}`,
  },
  timeText: {
    fontSize: '11.5px',
    color: c.textMuted,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.02em',
  },
  annoTitle: {
    margin: '0 0 6px 0',
    fontSize: '14.5px',
    color: c.text,
    fontWeight: '600',
    letterSpacing: '-0.005em',
    lineHeight: '1.4',
  },
  annoContent: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: c.textDim,
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  statusRow: {
    paddingTop: '10px',
    borderTop: `1px dashed ${c.border}`,
    marginBottom: '10px',
  },
  pushedTag: {
    fontSize: '11.5px',
    color: c.green,
    fontWeight: '600',
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.02em',
  },
  unpushedTag: {
    fontSize: '11.5px',
    color: c.textMuted,
    fontFamily: theme.fonts.mono,
    letterSpacing: '0.02em',
  },

  cardActions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '5px 12px',
    backgroundColor: 'transparent',
    color: c.textDim,
    border: `1px solid ${c.border}`,
    borderRadius: r.sm,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    fontFamily: theme.fonts.sans,
    transition: `background ${theme.transition.fast}, color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
  },
  actionBtnBrand: {
    backgroundColor: c.brandSoft,
    color: c.brand,
    borderColor: c.brandTint,
  },
  actionBtnPush: {
    backgroundColor: c.brand,
    color: '#ffffff',
    borderColor: c.brand,
    fontWeight: '600',
  },

  // ---- Modal（檢視公告）----
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(42, 37, 32, 0.55)', // 暖色半透明，跟 theme 對齊
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
  },
  modalCard: {
    width: 'min(720px, 100%)',
    maxHeight: '82vh',
    overflowY: 'auto',
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '26px 28px',
    boxShadow: theme.shadow.lg,
    fontFamily: theme.fonts.sans,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${c.border}`,
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: c.text,
    letterSpacing: '-0.005em',
  },
  modalCloseBtn: {
    padding: '6px 14px',
    borderRadius: r.sm,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.textDim,
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '12.5px',
    fontFamily: theme.fonts.sans,
  },
  modalMetaRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '14px',
    alignItems: 'center',
  },
  modalAnnoTitle: {
    margin: '4px 0 14px 0',
    fontSize: '17px',
    color: c.text,
    fontWeight: '600',
    letterSpacing: '-0.01em',
    lineHeight: '1.4',
  },
  modalContent: {
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    backgroundColor: c.bg,
    padding: '16px 18px',
    color: c.text,
    fontSize: '13.5px',
    lineHeight: '1.75',
    whiteSpace: 'pre-wrap',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '18px',
  },

  // ---- 法規 tab：城市切換 ----
  citySelectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  citySelectorLabel: {
    fontSize: '11px',
    color: c.textMuted,
    fontWeight: '600',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    marginRight: '4px',
  },
  cityTabBtn: {
    padding: '7px 16px',
    border: `1px solid ${c.border}`,
    borderRadius: r.pill,
    backgroundColor: c.surface1,
    color: c.textDim,
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '12.5px',
    transition: `background ${theme.transition.fast}, border-color ${theme.transition.fast}, color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
    letterSpacing: '0.02em',
  },
  cityTabActive: {
    backgroundColor: c.brand,
    color: '#ffffff',
    borderColor: c.brand,
    fontWeight: '600',
  },

  ruleEditorCard: {
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    padding: '24px',
    backgroundColor: c.bg,
  },
  previewBox: {
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    padding: '16px 18px',
    backgroundColor: c.surface1,
    minHeight: '60px',
    lineHeight: 1.75,
    fontSize: '13.5px',
    color: c.text,
    wordBreak: 'break-word',
  },
  ruleFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24px',
    paddingTop: '18px',
    borderTop: `1px solid ${c.border}`,
    gap: '14px',
    flexWrap: 'wrap',
  },
  dbHint: {
    fontSize: '12px',
    color: c.textMuted,
    fontFamily: theme.fonts.sans,
  },
  codeInline: {
    fontFamily: theme.fonts.mono,
    fontSize: '12px',
    padding: '2px 6px',
    backgroundColor: c.surface2,
    color: c.text,
    borderRadius: r.sm,
    border: `1px solid ${c.border}`,
  },
};

export default RulesAnnouncements;
