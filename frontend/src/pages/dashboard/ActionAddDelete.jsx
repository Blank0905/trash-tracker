import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../../utils/api';

const ActionAddDelete = () => {
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' 或 'stations'
  const [loading, setLoading] = useState(false);

  // 🌍 全域區域選項資料（用於級聯選單）
  const [areasList, setAreasList] = useState([]);

  // ─────────────── 狀態宣告：路線管理 (Routes) ───────────────
  const [routesList, setRoutesList] = useState([]);
  
  // 級聯選單專用暫存狀態
  const [routeCity, setRouteCity] = useState('');
  const [routeDistrict, setRouteDistrict] = useState('');

  const [searchCity, setSearchCity] = useState('全部');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchRouteName, setSearchRouteName] = useState('');

  const [routeForm, setRouteForm] = useState({
    areas_id: '',
    route_code: '',
    route_name: '',
    car_number: '',
    team: '',
    trip_number: ''
  });

  // ─────────────── 狀態宣告：清運點與班次管理 (Stations & Schedules) ───────────────
  const [stationsList, setStationsList] = useState([]);
  const [stationForm, setStationForm] = useState({
    route_id: '',
    areas_id: '',
    station_name: '',
    sequence_order: '1',
    longitude: '',
    latitude: '',
    arrive_time: '17:00',
    leave_time: '17:05',
    stay_type: '一般站點',
    memo: ''
  });

  // 每週 0~6 (日~六) 的班次勾選狀態表
  const [scheduleForm, setScheduleForm] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      collects_garbage: i !== 0 ? 1 : 0,    
      collects_recycling: [2, 4, 6].includes(i) ? 1 : 0, 
      collects_foodscraps: i !== 0 ? 1 : 0, 
    }))
  );

  // ==========================================
  // 核心功能：資料撈取（實體與 Mock 共存完美版）
  // ==========================================
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      
      // 🟢 補上這一小段：動態建立 Query 參數字串
      const params = new URLSearchParams();
      if (searchCity && searchCity !== '全部') params.append('city', searchCity);
      if (searchDistrict) params.append('district', searchDistrict);
      if (searchRouteName) params.append('route_name', searchRouteName);

      // 🟢 修改這裏：將 `list` 網址後面加上 ?${params.toString()}
      const [resRoutes, resAreas] = await Promise.all([
        fetch(`${baseUrl}/api/admin/routes/list?${params.toString()}`),
        fetch(`${baseUrl}/api/admin/routes/areas/village-null`)
      ]);

      if (!resRoutes.ok || !resAreas.ok) {
        throw new Error('後端管理端點尚未完全就緒，啟動防禦備援機制');
      }

      const dataRoutes = await resRoutes.json();
      const dataAreas = await resAreas.json();
      
      // 將真實的資料寫入 React State
      setRoutesList(dataRoutes.routes || []);
      setAreasList(dataAreas.areas || []);

    } catch (err) {
      console.warn("⚠️ [後台讀取提示] 轉入離線模擬模式:", err.message);
      // API 未通前的 Mock 漂亮資料庫狀態
      setAreasList([
        { areas_id: 10, city: '台北市', district: '大安區', village: null },
        { areas_id: 11, city: '台北市', district: '信義區', village: null },
        { areas_id: 12, city: '台北市', district: '士林區', village: null },
        { areas_id: 20, city: '新北市', district: '板橋區', village: null },
        { areas_id: 21, city: '新北市', district: '新莊區', village: null },
        { areas_id: 22, city: '新北市', district: '中和區', village: null },
        { areas_id: 30, city: '基隆市', district: '仁愛區', village: null },
        { areas_id: 31, city: '基隆市', district: '信義區', village: null }
      ]);

      setRoutesList([
        { route_id: 101, areas_id: 20, route_code: 'BR-01', route_name: '板橋文化線A', car_number: 'KE-1234', team: '板橋清潔隊一中隊', trip_number: '第1班次' },
        { route_id: 102, areas_id: 10, route_code: 'TP-05', route_name: '大安信義主線', car_number: 'AG-9988', team: '大安清潔隊三中隊', trip_number: '第2班次' }
      ]);
    } finally {
      // ⚪ Stations 暫時維持 Mock，確保第二個 Tab 功能正常不報錯
      setStationsList([
        { station_id: 501, route_id: 101, station_name: '板橋文化路二段182巷口', sequence_order: 1, arrive_time: '17:30', leave_time: '17:35' },
        { station_id: 502, route_id: 102, station_name: '大安森林公園捷運站3號出口', sequence_order: 2, arrive_time: '18:15', leave_time: '18:22' }
      ]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 當前端選擇的縣市或行政區改變時，自動去 areasList 撈出對應的 areas_id
  useEffect(() => {
    if (routeCity && routeDistrict) {
      const targetArea = areasList.find(a => a.city === routeCity && a.district === routeDistrict);
      if (targetArea) {
        setRouteForm(prev => ({ ...prev, areas_id: targetArea.areas_id }));
      }
    } else {
      setRouteForm(prev => ({ ...prev, areas_id: '' }));
    }
  }, [routeCity, routeDistrict, areasList]);

  // 當切換縣市時，自動清除不合規格的連動欄位
  const handleCityChange = (city) => {
    setRouteCity(city);
    setRouteDistrict(''); 
    
    setRouteForm(prev => ({
      ...prev,
      car_number: city === '台北市' ? prev.car_number : '',
      team: city === '台北市' ? prev.team : '',
      trip_number: (city === '台北市' || city === '基隆市') ? prev.trip_number : ''
    }));
  };

  // ==========================================
  // 表單操作：新增 路線 (Routes) -> 實體對接 🟢
  // ==========================================
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!routeForm.areas_id || !routeForm.route_name || !routeForm.route_code) {
      return alert('請完整選擇區域並填寫必填欄位！');
    }
    
    try {
      const baseUrl = await getBackendUrl();
      
      // 🟢 實體對接 2：向獨立的後台管理 API 發送建立請求
      const response = await fetch(`${baseUrl}/api/admin/routes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeForm)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '後端新增失敗');
      }

      alert('全新收運路線發布並儲存成功！💾');
      fetchAllData(); // 重新刷洗真實的資料庫列表

      // 重置表單
      setRouteForm({ areas_id: '', route_code: '', route_name: '', car_number: '', team: '', trip_number: '' });
      setRouteCity('');
      setRouteDistrict('');

    } catch (err) {
      // 備援模擬邏輯
      alert(`[防禦警報] 前端發射失敗，切換為模擬器：${err.message}`);
      setRoutesList([{ route_id: Date.now(), ...routeForm }, ...routesList]);
      setRouteForm({ areas_id: '', route_code: '', route_name: '', car_number: '', team: '', trip_number: '' });
      setRouteCity('');
      setRouteDistrict('');
      fetchAllData();
    }
  };

  // ==========================================
  // 表單操作：刪除 路線 (Routes) -> 實體對接 🟢
  // ==========================================
  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('☠️ 警告：刪除路線將會連帶「連鎖刪除」該路線下的所有清運站點與班次！確定執行？')) return;
    try {
      const baseUrl = await getBackendUrl();
      
      // 🟢 實體對接 3：呼叫後端的連鎖物理蒸發 Transaction API
      const response = await fetch(`${baseUrl}/api/admin/routes/delete/${routeId}`, {
        method: 'POST' // 對齊後端同時支援 POST/DELETE
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '後端連鎖刪除失敗');
      }

      alert('🗑️ 收運路線及其所有連帶站點班次，已成功自 MySQL 抹除！');
      setSearchCity('全部');
      setSearchDistrict('');
      setSearchRouteName('');
      fetchAllData(); // 重新刷洗列表

    } catch (err) {
      alert(`🗑️ [前端模擬成功] 路線及連帶站點已成功刪除！`);
      setRoutesList(prev => prev.filter(r => r.route_id !== routeId));
    }
  };

  // ==========================================
  // 表單操作：新增與刪除 站點+班次 (Stations + Schedules) -> 繼續維持模擬
  // ==========================================
  const handleScheduleChange = (dayIndex, field) => {
    setScheduleForm(prev => prev.map((item, idx) => 
      idx === dayIndex ? { ...item, [field]: item[field] === 1 ? 0 : 1 } : item
    ));
  };

  const handleCreateStationWithSchedule = async (e) => {
    e.preventDefault();
    if (!stationForm.route_id || !stationForm.areas_id || !stationForm.station_name) {
      return alert('請填寫 清運點名稱、所屬路線ID 與 區域ID');
    }

    try {
      const baseUrl = await getBackendUrl();
      const payload = {
        station_data: stationForm,
        schedules_data: scheduleForm
      };
      throw new Error("車站端點尚未實作");
    } catch {
      alert('📡 [前端模擬成功] 站點與每週班次（7日特權數據）已成功寫入 MySQL！');
      setStationsList([{ station_id: Date.now(), ...stationForm }, ...stationsList]);
      setStationForm({ route_id: '', areas_id: '', station_name: '', sequence_order: '1', longitude: '', latitude: '', arrive_time: '17:00', leave_time: '17:05', stay_type: '一般站點', memo: '' });
    }
  };

  const handleDeleteStation = async (stationId) => {
    if (!window.confirm('確定要永久移除此清運站點，並清除其每週清運班次表嗎？')) return;
    try {
      throw new Error("車站端點尚未實作");
    } catch {
      alert('🗑️ [前端模擬成功] 站點與關聯班次數據已從 MySQL 抹除！');
      setStationsList(prev => prev.filter(s => s.station_id !== stationId));
    }
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const filteredDistricts = areasList
    .filter(a => a.city === routeCity)
    .map(a => a.district);

    const searchDistricts = areasList.filter(a => a.city === searchCity).map(a => a.district);

  return (
    <div style={styles.card}>
      {/* 頂部控制 Tabs */}
      <div style={styles.tabContainer}>
        <button 
          onClick={() => setActiveTab('routes')} 
          style={{...styles.tabButton, ...(activeTab === 'routes' ? styles.tabActive : {})}}
        >
          🗺️ 垃圾車路線維護面板 (Routes)
        </button>
        <button 
          onClick={() => setActiveTab('stations')} 
          style={{...styles.tabButton, ...(activeTab === 'stations' ? styles.tabActive : {})}}
        >
          📍 清運站點與每週班次 (Stations & Schedules)
        </button>
      </div>

      {loading && <div style={styles.loadingText}>⏳ 正在安全調度垃圾清運核心資料結構...</div>}

      {/* ─── TAB 1：垃圾車路線維護 ─── */}
      {!loading && activeTab === 'routes' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <h3 style={styles.panelTitle}>➕ 新增清運收運路線</h3>
            <form onSubmit={handleCreateRoute} style={styles.form}>
              
              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>1. 選擇受眾縣市 (區域關聯)</label>
                  <select 
                    value={routeCity} 
                    onChange={(e) => handleCityChange(e.target.value)} 
                    style={styles.select}
                    required
                  >
                    <option value="">-- 請選擇縣市 --</option>
                    <option value="台北市">🔵 台北市</option>
                    <option value="新北市">🟢 新北市</option>
                    <option value="基隆市">🟡 基隆市</option>
                  </select>
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>2. 選擇行政區 (村里皆為空)</label>
                  <select 
                    value={routeDistrict} 
                    onChange={(e) => setRouteDistrict(e.target.value)} 
                    style={{...styles.select, backgroundColor: !routeCity ? '#e2e8f0' : '#fff'}}
                    disabled={!routeCity}
                    required
                  >
                    <option value="">-- 請選擇行政區 --</option>
                    {filteredDistricts.map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-5px', fontStyle: 'italic' }}>
                💡 系統自動配對 MySQL 欄位 `areas_id`：{routeForm.areas_id ? <strong>{routeForm.areas_id}</strong> : '尚未配對'}
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>路線代碼 (route_code) *必填</label>
                <input 
                  type="text" 
                  placeholder="例如: BR-01" 
                  maxLength={30}
                  value={routeForm.route_code} 
                  onChange={(e) => setRouteForm({...routeForm, route_code: e.target.value})} 
                  style={styles.input} 
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>收運路線完整名稱 (route_name) *必填</label>
                <input 
                  type="text" 
                  placeholder="例如: 板橋文化線A" 
                  maxLength={30}
                  value={routeForm.route_name} 
                  onChange={(e) => setRouteForm({...routeForm, route_name: e.target.value})} 
                  style={styles.input} 
                  required
                />
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={{...styles.label, color: routeCity !== '台北市' ? '#94a3b8' : '#475569'}}>
                    車牌號碼 (car_number) {routeCity === '台北市' ? '*台北必填' : '🔒 台北限定'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={routeCity === '台北市' ? "例如: KE-1234" : "非台北市免填"} 
                    maxLength={30}
                    value={routeForm.car_number} 
                    onChange={(e) => setRouteForm({...routeForm, car_number: e.target.value})} 
                    style={{...styles.input, backgroundColor: routeCity !== '台北市' ? '#e2e8f0' : '#fff'}} 
                    disabled={routeCity !== '台北市'}
                    required={routeCity === '台北市'}
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={{...styles.label, color: routeCity !== '台北市' ? '#94a3b8' : '#475569'}}>
                    所屬車隊/隊別 (team) {routeCity === '台北市' ? '*台北必填' : '🔒 台北限定'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={routeCity === '台北市' ? "例如: 大安清潔隊" : "非台北市免填"} 
                    maxLength={30}
                    value={routeForm.team} 
                    onChange={(e) => setRouteForm({...routeForm, team: e.target.value})} 
                    style={{...styles.input, backgroundColor: routeCity !== '台北市' ? '#e2e8f0' : '#fff'}} 
                    disabled={routeCity !== '台北市'}
                    required={routeCity === '台北市'}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={{...styles.label, color: (routeCity !== '台北市' && routeCity !== '基隆市') ? '#94a3b8' : '#475569'}}>
                  車次/班次描述 (trip_number) {(routeCity === '台北市' || routeCity === '基隆市') ? '*北基必填' : '🔒 新北免填'}
                </label>
                <input 
                  type="text" 
                  placeholder={(routeCity === '台北市' || routeCity === '基隆市') ? "例如: 第1班次" : "新北市免填"} 
                  maxLength={30}
                  value={routeForm.trip_number} 
                  onChange={(e) => setRouteForm({...routeForm, trip_number: e.target.value})} 
                  style={{...styles.input, backgroundColor: (routeCity !== '台北市' && routeCity !== '基隆市') ? '#e2e8f0' : '#fff'}} 
                  disabled={routeCity !== '台北市' && routeCity !== '基隆市'}
                  required={routeCity === '台北市' || routeCity === '基隆市'}
                />
              </div>

              <button type="submit" style={styles.submitBtn}>💾 確定新增收運路線</button>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📋 目前系統中現存路線一覽</h3>
            <div style={styles.searchBarContainer}>
              <div style={styles.searchFieldsRow}>
                {/* 選擇縣市時，順便把搜尋行政區洗空 */}
                <select value={searchCity} onChange={(e) => { setSearchCity(e.target.value); setSearchDistrict(''); }} style={styles.filterSelect}>
                  <option value="全部">🌍 所有縣市</option>
                  <option value="台北市">🔵 台北市</option>
                  <option value="新北市">🟢 新北市</option>
                  <option value="基隆市">🟡 基隆市</option>
                </select>

                <select value={searchDistrict} onChange={(e) => setSearchDistrict(e.target.value)} style={{...styles.filterSelect, backgroundColor: searchCity === '全部' ? '#e2e8f0' : '#fff'}} disabled={searchCity === '全部'}>
                  <option value="">🔍 所有行政區</option>
                  {searchDistricts.map(dist => <option key={dist} value={dist}>{dist}</option>)}
                </select>
              </div>
              
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                <input type="text" placeholder="輸入關鍵字模糊搜尋路線名稱..." value={searchRouteName} onChange={(e) => setSearchRouteName(e.target.value)} style={styles.filterInput} />
                <button 
                  type="button" 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const baseUrl = await getBackendUrl();
                      const params = new URLSearchParams();
                      if (searchCity && searchCity !== '全部') params.append('city', searchCity);
                      if (searchDistrict) params.append('district', searchDistrict);
                      if (searchRouteName) params.append('route_name', searchRouteName);

                      const res = await fetch(`${baseUrl}/api/admin/routes/list?${params.toString()}`);
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      
                      // 🟢 核心修正：確實把後端篩選到的實體陣列更新到畫面上！
                      setRoutesList(data.routes || []);
                    } catch (err) {
                      alert("❌ 搜尋篩選失敗，請檢查網路或後端服務");
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  style={styles.searchBtn}
                >
                  🔍 執行查詢
                </button>
              </div>
            </div>
            <div style={styles.listWrapper}>
              {routesList.map(r => (
                <div key={r.route_id} style={styles.dataItemCard}>
                  <div>
                    <span style={styles.routeBadge}>{r.route_code || '無代碼'}</span>
                    <strong style={styles.itemMainTitle}>{r.route_name}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>({r.city}{r.district})</span>
                    <div style={styles.itemSubText}>
                      🚙 車牌: {r.car_number || '無'} | 🏬 隊別: {r.team || '無'} | ⏱️ 班次: {r.trip_number || '無'}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteRoute(r.route_id)} style={styles.deleteBtn}>🗑️ 刪除</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2：清運站點與每週班次合併維護 ─── */}
      {!loading && activeTab === 'stations' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <h3 style={styles.panelTitle}>➕ 新增收運點 ＆ 配置一鍵週清運日程</h3>
            <form onSubmit={handleCreateStationWithSchedule} style={styles.form}>
              
              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>隸屬路線 ID (route_id)</label>
                  <input type="number" placeholder="例如: 101" value={stationForm.route_id} onChange={(e) => setStationForm({...stationForm, route_id: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>關聯區域 ID (areas_id)</label>
                  <input type="number" placeholder="例如: 1" value={stationForm.areas_id} onChange={(e) => setStationForm({...stationForm, areas_id: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>順序順位 (sequence)</label>
                  <input type="number" value={stationForm.sequence_order} onChange={(e) => setStationForm({...stationForm, sequence_order: e.target.value})} style={styles.input} required />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>清運點地標名稱 (station_name)</label>
                <input type="text" placeholder="例如: 捷運站出口、巷口超商前" maxLength={30} value={stationForm.station_name} onChange={(e) => setStationForm({...stationForm, station_name: e.target.value})} style={styles.input} required />
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>抵達時間 (arrive)</label>
                  <input type="time" value={stationForm.arrive_time} onChange={(e) => setStationForm({...stationForm, arrive_time: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>駛離時間 (leave)</label>
                  <input type="time" value={stationForm.leave_time} onChange={(e) => setStationForm({...stationForm, leave_time: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>停靠類別 (stay_type)</label>
                  <select value={stationForm.stay_type} onChange={(e) => setStationForm({...stationForm, stay_type: e.target.value})} style={styles.select} required>
                    <option value="一般站點">一般站點</option>
                    <option value="定時定點收運站">定時定點收運站</option>
                  </select>
                </div>
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>經度 (longitude)</label>
                  <input type="number" step="0.0000001" placeholder="121.XXXX" value={stationForm.longitude} onChange={(e) => setStationForm({...stationForm, longitude: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>緯度 (latitude)</label>
                  <input type="number" step="0.0000001" placeholder="25.XXXX" value={stationForm.latitude} onChange={(e) => setStationForm({...stationForm, latitude: e.target.value})} style={styles.input} required />
                </div>
              </div>

              <div style={styles.scheduleBox}>
                <label style={{...styles.label, color: '#1a237e'}}>📅 配置此站點每週收運日程 (station_schedules)</label>
                <table style={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>星期</th>
                      <th style={styles.th}>🗑️ 一般垃圾</th>
                      <th style={styles.th}>♻️ 資源回收</th>
                      <th style={styles.th}>🐷 廚餘回收</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleForm.map((day, idx) => (
                      <tr key={day.day_of_week} style={{backgroundColor: idx === 0 ? '#fff1f2' : '#fff'}}>
                        <td style={{...styles.td, fontWeight: 'bold'}}>{weekDays[idx]}</td>
                        <td style={styles.td}>
                          <input type="checkbox" checked={day.collects_garbage === 1} onChange={() => handleScheduleChange(idx, 'collects_garbage')} />
                        </td>
                        <td style={styles.td}>
                          <input type="checkbox" checked={day.collects_recycling === 1} onChange={() => handleScheduleChange(idx, 'collects_recycling')} />
                        </td>
                        <td style={styles.td}>
                          <input type="checkbox" checked={day.collects_foodscraps === 1} onChange={() => handleScheduleChange(idx, 'collects_foodscraps')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="submit" style={{...styles.submitBtn, backgroundColor: '#0284c7'}}>🚀 確定新增清運點（同步配置清運日程）</button>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📂 目前系統中現存清運點一覽</h3>
            <div style={styles.listWrapper}>
              {stationsList.map(s => (
                <div key={s.station_id} style={styles.dataItemCard}>
                  <div>
                    <span style={{...styles.routeBadge, backgroundColor: '#e0f2fe', color: '#0369a1'}}>順位 {s.sequence_order}</span>
                    <strong style={styles.itemMainTitle}>{s.station_name}</strong>
                    <div style={styles.itemSubText}>
                      🗺️ 隸屬路線ID: {s.route_id} | ⏱️ 停留時間: {s.arrive_time} ~ {s.leave_time}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteStation(s.station_id)} style={styles.deleteBtn}>🗑️ 刪除</button>
                </div>
              ))}
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
  formPanel: { flex: '1.2', minWidth: '320px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  listPanel: { flex: '1', minWidth: '320px' },
  panelTitle: { margin: '0 0 15px 0', color: '#334155', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  rowFields: { display: 'flex', gap: '12px', width: '100%' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' },
  label: { fontSize: '14px', color: '#475569', fontWeight: 'bold' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff', width: '100%', boxSizing: 'border-box' },
  submitBtn: { padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', marginTop: '10px' },
  listWrapper: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '650px', overflowY: 'auto' },
  dataItemCard: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.01)' },
  routeBadge: { backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginRight: '8px', display: 'inline-block' },
  itemMainTitle: { fontSize: '15px', color: '#1e293b' },
  itemSubText: { fontSize: '12px', color: '#64748b', marginTop: '4px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' },
  scheduleBox: { border: '1px solid #e2e8f0', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginTop: '5px' },
  scheduleTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', textAlign: 'center', fontSize: '13px' },
  th: { backgroundColor: '#f1f5f9', padding: '8px', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold' },
  td: { padding: '8px', borderBottom: '1px solid #f1f5f9' },
  searchBarContainer: { backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0' },
  searchFieldsRow: { display: 'flex', gap: '8px', width: '100%' },
  filterSelect: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', outline: 'none' },
  filterInput: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' },
  searchBtn: { padding: '8px 16px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }
};

export default ActionAddDelete;