import React, { useState, useEffect } from 'react';

// 💡 這是一個萬能範本，外面傳入 tableName，它就會自動去抓對應的資料與結構
const TableTemplate = ({ tableName }) => {
  // 分頁狀態：'browse' (瀏覽) 或 'structure' (結構)
  const [currentTab, setCurrentTab] = useState('browse');

  // 「瀏覽」工具列狀態 (完全對應你給的截圖功能)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500); // 預設照截圖顯示 500 筆
  const [filterText, setFilterText] = useState('');
  const [sortOrder, setSortOrder] = useState('none'); // 無, ASC, DESC

  // 從 API 抓回來的真实資料狀態
  const [browseData, setBrowseData] = useState([]); // 存放「瀏覽」的資料列
  const [structureData, setStructureData] = useState([]); // 存放「結構」的欄位資訊
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔌 核心 useEffect：當切換表名、分頁、排序、篩選時，強制戳 API 連線！
  useEffect(() => {
    const fetchTableData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (currentTab === 'browse') {
          // 萬能瀏覽 API 端點，把工具列參數全部帶給後端
          const url = `http://localhost:8000/api/db/browse?table=${tableName}&page=${currentPage}&limit=${pageSize}&search=${filterText}&sort=${sortOrder}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`無法取得 ${tableName} 的瀏覽資料`);
          const data = await res.json();
          setBrowseData(data);
        } else {
          // 萬能結構 API 端點
          const url = `http://localhost:8000/api/db/structure?table=${tableName}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`無法取得 ${tableName} 的結構資訊`);
          const data = await res.json();
          setStructureData(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTableData();
  }, [tableName, currentTab, currentPage, pageSize, filterText, sortOrder]);

  // === 渲染「瀏覽」分頁 ===
  const renderBrowseTab = () => {
    if (browseData.length === 0) {
      return <div style={styles.noData}>此資料表目前沒有任何數據，或查無相符結果。</div>;
    }

    const headers = Object.keys(browseData[0]);

    return (
      <div style={styles.tableWrapper}>
        <table style={styles.sqlTable}>
          <thead>
            <tr>
              {headers.map(h => <th key={h} style={styles.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {browseData.map((row, idx) => (
              <tr key={idx} style={styles.tr}>
                {headers.map(h => (
                  <td key={h} style={styles.td}>
                    {row[h] === null ? <span style={styles.nullText}>NULL</span> : String(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // === 渲染「結構」分頁 ===
  const renderStructureTab = () => {
    if (structureData.length === 0) {
      return <div style={styles.noData}>無法載入結構資訊。</div>;
    }

    return (
      <div style={styles.tableWrapper}>
        <table style={styles.sqlTable}>
          <thead>
            <tr>
              <th style={styles.th}>欄位 (Field)</th>
              <th style={styles.th}>型態 (Type)</th>
              <th style={styles.th}>空值 (Null)</th>
              <th style={styles.th}>鍵值 (Key)</th>
              <th style={styles.th}>預設值 (Default)</th>
              <th style={styles.th}>額外資訊 (Extra)</th>
            </tr>
          </thead>
          <tbody>
            {structureData.map((col, idx) => (
              <tr key={idx} style={styles.tr}>
                <td style={{...styles.td, fontWeight: 'bold', color: '#1e293b'}}>{col.Field}</td>
                <td style={{...styles.td, fontFamily: 'monospace', color: '#0284c7'}}>{col.Type}</td>
                <td style={styles.td}>{col.Null}</td>
                <td style={styles.td}>
                  {col.Key === 'PRI' && <span style={styles.priBadge}>主鍵 (PK)</span>}
                  {col.Key === 'MUL' && <span style={styles.fkBadge}>外鍵 (FK)</span>}
                  {col.Key !== 'PRI' && col.Key !== 'MUL' && col.Key}
                </td>
                <td style={styles.td}>{col.Default === null ? 'None' : col.Default}</td>
                <td style={styles.td}>{col.Extra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={styles.card}>
      {/* 頂部 phpMyAdmin 風格雙分頁籤 */}
      <div style={styles.tabContainer}>
        <button 
          onClick={() => setCurrentTab('browse')} 
          style={{...styles.tabButton, ...(currentTab === 'browse' ? styles.tabActive : {})}}
        >
          🔍 瀏覽 (Browse)
        </button>
        <button 
          onClick={() => setCurrentTab('structure')} 
          style={{...styles.tabButton, ...(currentTab === 'structure' ? styles.tabActive : {})}}
        >
          🏗️ 結構 (Structure)
        </button>
      </div>

      {/* 核心內容 */}
      {loading ? (
        <div style={styles.statusBox}>⏳ 正在戳 API 連線 MySQL 獲取 <code>{tableName}</code> 的資料...</div>
      ) : error ? (
        <div style={styles.errorBox}>
          <h4>❌ API 讀取失敗</h4>
          <p>{error}</p>
          <p style={{fontSize: '13px', color: '#666', marginTop: '10px'}}>
            提示：前端面板已就緒。請叫後端同學開通萬能路由，並綁定資料表 <code>{tableName}</code> 喔！
          </p>
        </div>
      ) : (
        <div>
          {/* 只有在「瀏覽」分頁，才秀出你截圖上的 phpMyAdmin 工具列 */}
          {currentTab === 'browse' && (
            <div style={styles.phpMyAdminToolbar}>
              {/* 頁碼與換頁 */}
              <select value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} style={styles.select}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
              <button style={styles.navBtn}>&gt;</button>
              <button style={styles.navBtn}>&gt;&gt;</button>
              
              <div style={styles.divider}>|</div>

              {/* 資料列數 */}
              <span style={styles.toolbarLabel}>資料列數：</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={styles.select}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>

              {/* 篩選 */}
              <span style={styles.toolbarLabel}>篩選資料列：</span>
              <input 
                type="text" 
                placeholder="搜尋此資料表" 
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={styles.input} 
              />

              {/* 主鍵排序 */}
              <span style={styles.toolbarLabel}>依主鍵 (PK) 排序：</span>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={styles.select}>
                <option value="none">預設（無）</option>
                <option value="ASC">遞增 (ASC)</option>
                <option value="DESC">遞減 (DESC)</option>
                </select>
            </div>
          )}

          {/* 真正切換渲染視窗 */}
          {currentTab === 'browse' ? renderBrowseTab() : renderStructureTab()}
        </div>
      )}
    </div>
  );
};

// 排版整齊、漂亮換行的專屬樣式表
const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    padding: '20px',
  },
  tabContainer: {
    display: 'flex',
    gap: '5px',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '20px',
  },
  tabButton: {
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#64748b',
    cursor: 'pointer',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#1a237e',
    backgroundColor: '#e8eaf6',
    borderBottom: '3px solid #1a237e',
  },
  // 1:1 還原圖片灰色漸層工具列
  phpMyAdminToolbar: {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(to bottom, #ffffff 0%, #e6e6e6 100%)',
    border: '1px solid #cccccc',
    borderRadius: '6px',
    padding: '8px 15px',
    gap: '12px',
    fontSize: '14px',
    color: '#333333',
    marginBottom: '20px',
    boxShadow: 'inset 0 1px 0 #ffffff',
  },
  select: {
    padding: '4px 8px',
    border: '1px solid #aaa',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  navBtn: {
    padding: '4px 10px',
    border: '1px solid #ccc',
    background: '#f5f5f5',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
  },
  divider: {
    color: '#bbb',
    fontWeight: 'bold',
  },
  toolbarLabel: {
    fontWeight: '500',
  },
  input: {
    padding: '4px 10px',
    border: '1px solid #aaa',
    borderRadius: '4px',
    width: '180px',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
  },
  sqlTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
  },
  th: {
    padding: '12px 15px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontWeight: '700',
    borderBottom: '2px solid #cbd5e1',
  },
  td: {
    padding: '12px 15px',
    borderBottom: '1px solid #e2e8f0',
    color: '#334155',
  },
  tr: {
    backgroundColor: '#fff',
  },
  nullText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  priBadge: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  fkBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  statusBox: {
    padding: '30px',
    textAlign: 'center',
    color: '#666',
  },
  errorBox: {
    padding: '25px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    border: '1px solid #ffcdd2',
  },
  noData: {
    padding: '30px',
    textAlign: 'center',
    color: '#94a3b8',
  }
};

export default TableTemplate;