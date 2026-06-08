import React, { useState, useEffect } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import { theme } from '../../utils/theme';

const c = theme.colors;
const r = theme.radius;

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
    backgroundColor: c.surface1,
    borderRadius: r.lg,
    border: `1px solid ${c.border}`,
    padding: '20px',
    fontFamily: theme.fonts.sans,
  },
  // Tab bar 改成現代 SaaS 風（細底線 + active indigo 底線而非 backgroundFill）
  tabContainer: {
    display: 'flex', gap: '0',
    borderBottom: `1px solid ${c.border}`,
    marginBottom: '18px',
  },
  tabButton: {
    padding: '10px 16px',
    border: 'none', background: 'none',
    fontSize: '13.5px', fontWeight: '500',
    color: c.textDim, cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: `color ${theme.transition.fast}, border-color ${theme.transition.fast}`,
    fontFamily: theme.fonts.sans,
  },
  tabActive: {
    color: c.brand, fontWeight: '600',
    borderBottomColor: c.brand,
  },
  // 工具列：捨棄 phpMyAdmin 灰漸層，改現代 SaaS 風（淡灰底 + 細邊）
  phpMyAdminToolbar: {
    display: 'flex', alignItems: 'center',
    backgroundColor: c.surface2,
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
    padding: '8px 12px', gap: '10px',
    fontSize: '13px', color: c.text,
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  select: {
    padding: '5px 10px',
    border: `1px solid ${c.border}`,
    borderRadius: r.sm,
    backgroundColor: c.surface1,
    color: c.text,
    fontSize: '12.5px',
    fontFamily: theme.fonts.sans,
    cursor: 'pointer',
    outline: 'none',
  },
  navBtn: {
    padding: '5px 11px',
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface1,
    color: c.textDim,
    cursor: 'pointer',
    borderRadius: r.sm,
    fontSize: '12px',
    fontFamily: theme.fonts.sans,
    transition: `background ${theme.transition.fast}, color ${theme.transition.fast}`,
  },
  divider: { color: c.borderStrong, fontWeight: '400' },
  toolbarLabel: {
    fontWeight: '500', color: c.textDim, fontSize: '12.5px',
  },
  input: {
    padding: '5px 10px',
    border: `1px solid ${c.border}`,
    borderRadius: r.sm,
    backgroundColor: c.surface1,
    color: c.text,
    width: '180px',
    fontSize: '12.5px',
    fontFamily: theme.fonts.sans,
    outline: 'none',
    transition: `border-color ${theme.transition.fast}`,
  },
  tableWrapper: {
    overflowX: 'auto',
    border: `1px solid ${c.border}`,
    borderRadius: r.md,
  },
  sqlTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  // 表頭：uppercase 小字 + 淺灰底（modern data table）
  th: {
    padding: '10px 14px',
    backgroundColor: c.surface2,
    color: c.textMuted,
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${c.border}`,
    whiteSpace: 'nowrap',
    fontFamily: theme.fonts.sans,
  },
  td: {
    padding: '10px 14px',
    borderBottom: `1px solid ${c.border}`,
    color: c.text,
    fontFamily: theme.fonts.mono,
    fontSize: '12.5px',
    letterSpacing: '0.01em',
  },
  tr: { backgroundColor: c.surface1 },
  nullText: {
    color: c.textFaint,
    fontStyle: 'italic',
    fontFamily: theme.fonts.sans,
  },
  // 主鍵 PK 徽章：amber soft（從原本橘紅實心改成淡 amber soft）
  priBadge: {
    backgroundColor: c.amberSoft, color: c.amber,
    padding: '2px 8px', borderRadius: r.sm,
    fontSize: '11px', fontWeight: '600',
    fontFamily: theme.fonts.sans, letterSpacing: '0.01em',
    border: `1px solid rgba(217, 119, 6, 0.25)`,
  },
  // 外鍵 FK 徽章：blue soft
  fkBadge: {
    backgroundColor: c.blueSoft, color: c.blue,
    padding: '2px 8px', borderRadius: r.sm,
    fontSize: '11px', fontWeight: '600',
    fontFamily: theme.fonts.sans, letterSpacing: '0.01em',
    border: `1px solid rgba(9, 105, 218, 0.25)`,
  },
  statusBox: {
    padding: '40px 24px',
    textAlign: 'center',
    color: c.textMuted, fontSize: '13px',
  },
  errorBox: {
    padding: '16px 20px',
    backgroundColor: c.redSoft, color: c.red,
    borderRadius: r.md,
    border: `1px solid rgba(220, 38, 38, 0.25)`,
  },
  noData: {
    padding: '40px 24px',
    textAlign: 'center',
    color: c.textMuted, fontSize: '13px',
  },
};

export default TableTemplate;