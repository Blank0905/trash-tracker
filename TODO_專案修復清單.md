# 專案修復 TODO 清單

## P0 先處理（不修就跑不起來）
1. ~~修正管理模組匯入炸裂問題。~~ ✅ 已完成  
   檔案：`backend/app/__init__.py`、`backend/app/api/admin.py`  
   內容：`create_app` 匯入 `admin.bp`，但 `admin.py` 目前是獨立 Flask app 且有 `!password` 語法錯誤。要改成真正 Blueprint，或先移除註冊。  
   處理：移除 `__init__.py` 對 `admin_bp` 的 import 與註冊；刪除 `admin.py`（壞檔、端點與 `__init__.py` 重複）與 `db_admin.py`（`app/db.py` 的重複舊版，刪 admin 後無人引用，順帶完成 P1-8）。驗證 `create_app()` 可正常載入（28 條路由）。
2. ~~移除/重建前端二進位假檔。~~ ✅ 已完成  
   檔案：`frontend/src/pages/dashboard/ActionAddDelete.jsx`、`frontend/src/pages/dashboard/UsersManage.jsx`  
   內容：目前是 OLE 二進位，不是 JSX，建置會壞。  
   處理：兩檔原為偽裝成 .jsx 的 OLE2 Office 文件（各 59904 bytes、內容相同）。已重建為乾淨佔位 JSX 元件，並把 `Dashboard.jsx` 的 inline dummy 改成實際掛載這兩個元件。真功能（改 role、新增/刪除）待 P2-11 後端寫入 API 完成後補上。未跑完整 build（前端 node_modules 未安裝），但檔案型態已從 OLE2 變回合法 UTF-8 JSX。
3. ~~對齊前後端連線 port。~~ ✅ 已完成  
   檔案：`frontend/src/utils/api.js`、`backend/run.py`  
   內容：前端打 `8000`，後端預設 `5000`，需統一（或改成環境變數）。  
   處理：統一用 `5000`（對齊 `run.py` 預設與所有專案文件：README `--port=5000`、ARCHITECTURE `localhost:5000/health`、接口規格 `localhost:5000/api`）。`api.js` 的 `publicUrl`/`localUrl` 改為 `5000`；`run.py` 已是 `5000` 無需改。全前端已無殘留 `8000`。

## P1 高優先（安全與核心正確性）
4. 移除硬編碼金鑰，全部改環境變數。  
   檔案：`backend/config.py`
5. 修正登入密碼驗證。  
   檔案：`backend/app/__init__.py`  
   內容：現在是 `password_hash == password`，需改 `check_password_hash`。
6. 導入真正的管理員驗證機制。  
   檔案：`backend/app/utils/auth.py`、`backend/app/__init__.py`  
   內容：`/api/db-*` 應受保護，不可裸露。
7. 讓 token 真正生效（或移除假 token 設計）。  
   檔案：`frontend/src/pages/Login.jsx`、`frontend/src/App.js`、後端所有管理端 API。
8. ~~清掉重複且過時的 DB 管理實作。~~ ✅ 已完成（隨 P0-1 一併處理）  
   檔案：`backend/app/api/db_admin.py`、`backend/app/api/admin.py`  
   內容：避免與 `app/db.py`、`app/__init__.py` 重複衝突。  
   處理：兩檔已刪除。`app/db.py` 為唯一正版資料存取層（連線池 + 讀 config）。

## P2 功能完整性（目前沒做完）
9. 補齊空頁面與空模組。  
   檔案：`frontend/src/pages/Announcements.jsx`、`frontend/src/pages/DbBrowser.jsx`、`frontend/src/pages/SyncMonitor.jsx`、`frontend/src/pages/Users.jsx`、`frontend/src/pages/dashboard/RulesAnnouncements.jsx`、`frontend/src/auth/AuthContext.jsx`、`frontend/src/api/client.js`
10. 把 Dashboard 的 placeholder 改成真頁面掛載。  
    檔案：`frontend/src/pages/Dashboard.jsx`
11. 建立 `/api/admin/*` 正式 API（使用者管理、公告管理、同步監看、快速維護）。  
    檔案：`backend/app/api/`（新建 blueprint，掛到 app factory）
12. 補上管理頁與 API 的欄位驗證、錯誤碼一致化、回傳格式一致化。

## P2 效能與穩定
13. 改善通知列表 N+1 query。  
    檔案：`backend/app/api/notifications.py`
14. 為 DB Browser 加上上限與防呆。  
    檔案：`backend/app/db.py`  
    內容：限制 `limit/page`、非法 `search/sort`、防重查。
15. 排程工作加上更完整錯誤紀錄與失敗重試策略。  
    檔案：`backend/app/tasks/notifier.py`、`backend/app/tasks/data_sync.py`

## P3 測試與工程品質
16. 修正前端測試（目前還是 CRA 預設，必壞）。  
    檔案：`frontend/src/App.test.js`
17. 增加後端 API 單元/整合測試（auth、favorites、notifications、db browse、admin）。  
    檔案：新增 `backend/tests/*`
18. 增加前端整合測試（登入流程、表格瀏覽、錯誤狀態、登出）。
19. 文件對齊現況，移除過時說明。  
    檔案：`README.md`、`ARCHITECTURE.md`
