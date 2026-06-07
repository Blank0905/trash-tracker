import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';

const TableTemplate = ({ tableName }) => {
  const [currentTab, setCurrentTab] = useState('browse');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500); 
  const [filterText, setFilterText] = useState('');
  const [filterTextDraft, setFilterTextDraft] = useState('');
  const [searchField, setSearchField] = useState('__all__');
  const [sortOrder, setSortOrder] = useState('none'); 

  const [browseData, setBrowseData] = useState([]); 
  const [tableColumns, setTableColumns] = useState([]); 
  const [totalRows, setTotalRows] = useState(0); 
  const [structureData, setStructureData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTableData = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = await getBackendUrl(); 

        if (currentTab === 'browse') {
          const params = new URLSearchParams({
            table: tableName,
            page: String(currentPage),
            limit: String(pageSize),
            search: filterText,
            sort: sortOrder,
          });
          if (searchField !== '__all__') {
            params.set('search_fields', searchField);
          }

          const url = `${baseUrl}/api/db/browse?${params.toString()}`;
          const res = await authedFetch(url);
          if (!res.ok) throw new Error(`無法取得 ${tableName} 的瀏覽資料`);
          
          const result = await res.json();
          setBrowseData(result.data || []); 
          setTotalRows(result.total || 0);  
          setTableColumns(result.columns || []); 
        } else {
          const url = `${baseUrl}/api/db/structure?table=${tableName}`;
          const res = await authedFetch(url);
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
  }, [tableName, currentTab, currentPage, pageSize, filterText, searchField, sortOrder]);

  useEffect(() => {
    setSearchField('__all__');
    setFilterText(''); // 切換資料表時清空搜尋條件
  }, [tableName]);

  useEffect(() => {
    setFilterTextDraft(filterText);
  }, [filterText]);

  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1);

  // 執行搜尋的動作：將草稿同步到實際觸發 API 的狀態中
  const handleSearchSubmit = () => {
    setFilterText(filterTextDraft);
    setCurrentPage(1); // 搜尋時重設回第一頁
  };

  const renderBrowseTab = () => {
    if (browseData.length === 0) return <div style={styles.noData}>此資料表目前沒有任何數據。</div>;
    
    const headers = tableColumns.length > 0 ? tableColumns : Object.keys(browseData[0]);
    
    return (
      <div style={styles.tableWrapper}>
        <table style={styles.sqlTable}>
          <thead>
            <tr>{headers.map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
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

  const renderStructureTab = () => {
    if (structureData.length === 0) return <div style={styles.noData}>無法載入結構資訊。</div>;
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
                <td style={{...styles.td, fontWeight: 'bold'}}>{col.Field}</td>
                <td style={{...styles.td, color: '#0284c7', fontFamily: 'monospace'}}>{col.Type}</td>
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
      <div style={styles.tabContainer}>
        <button onClick={() => setCurrentTab('browse')} style={{...styles.tabButton, ...(currentTab === 'browse' ? styles.tabActive : {})}}>🔍 瀏覽 (Browse)</button>
        <button onClick={() => setCurrentTab('structure')} style={{...styles.tabButton, ...(currentTab === 'structure' ? styles.tabActive : {})}}>🏗️ 結構 (Structure)</button>
      </div>

      {loading ? (
        <div style={styles.statusBox}>⏳ 正在連線 MySQL 獲取 <code>{tableName}</code> 資料...</div>
      ) : error ? (
        <div style={styles.errorBox}><h4>❌ API 讀取失敗</h4><p>{error}</p></div>
      ) : (
        <div>
          {currentTab === 'browse' && (
            <div style={styles.phpMyAdminToolbar}>
              <select value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} style={styles.select}>
                {pageOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} style={styles.navBtn}>&gt;</button>
              <button onClick={() => setCurrentPage(totalPages)} style={styles.navBtn}>&gt;&gt;</button>
              
              <div style={styles.divider}>|</div>
              <span style={styles.toolbarLabel}>資料列數：</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={styles.select}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>

              <span style={styles.toolbarLabel}>篩選資料列：</span>
              <div style={{ display: 'inline-flex', alignItems: 'center()', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="搜尋後按 Enter 或點擊 🔍"
                  value={filterTextDraft}
                  onChange={(e) => setFilterTextDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  style={{ ...styles.input, paddingRight: '30px' }} // 留右邊空間給放大鏡
                />
                <button 
                  onClick={handleSearchSubmit}
                  title="執行搜尋"
                  style={{
                    position: 'absolute',
                    right: '5px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px'
                  }}
                >
                  🔍
                </button>
              </div>

              <span style={styles.toolbarLabel}>搜尋欄位：</span>
              <select value={searchField} onChange={(e) => { setSearchField(e.target.value); setCurrentPage(1); }} style={styles.select}>
                <option value="__all__">全部文字欄位</option>
                {tableColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>

              <span style={styles.toolbarLabel}>依主鍵排序：</span>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={styles.select}>
                <option value="none">無</option>
                <option value="ASC">遞增 (ASC)</option>
                <option value="DESC">遞減 (DESC)</option>
              </select>
            </div>
          )}

          {currentTab === 'browse' ? renderBrowseTab() : renderStructureTab()}
          
          {currentTab === 'browse' && (
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '15px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
              顯示第 {browseData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} 到 {Math.min(currentPage * pageSize, totalRows)} 筆，🔍 資料庫內總計：<strong>{totalRows}</strong> 筆資料
            </div>
          )}
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