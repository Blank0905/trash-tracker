# 專案修復 TODO 清單

> 更新日期：2026-06-07
> 範圍：以目前程式碼實作為準，只列「尚未解決」的問題。已修復項目（P0 匯入炸裂、二進位假檔、密碼雜湊驗證、金鑰改環境變數、DB Browser 防呆、db_admin/admin 重複實作等）已從本清單移除。

---

## P1 安全（最高優先，目前最大破口）

### 1. 所有管理端 API 完全沒有身分驗證
任何人只要知道網址就能讀寫整個資料庫，這是目前最嚴重的問題。

- 裸露的端點：
  - `backend/app/__init__.py`：`/api/db-status`、`/api/db/browse`、`/api/db/structure`（可瀏覽任意資料表全部內容）。
  - `backend/app/api/etl.py`（`/api/admin/etl/*`）：可改 ETL 來源網址、手動觸發 ETL。
  - `backend/app/api/add_delete_route.py`（`/api/admin/routes/*`）：可新增/刪除路線。
  - `backend/app/api/add_delete_station.py`（`/api/admin/stations/*`）：可新增/刪除站點。
  - `backend/app/api/bags.py`（`/api/admin/bag-regulations`）：可改清運規範。
  - `backend/app/api/announcements.py`（`/api/announcements`）、`backend/app/api/rules.py`（`/api/rules`）：管理寫入操作未保護。
- 現況：`backend/app/utils/auth.py` 已寫好 `admin_required` 裝飾器，但**沒有任何一支管理 API 使用它**（`etl.py` 註解明寫「暫未加 admin_required，日後統一處理」）。
- 建議：為上述所有「管理/寫入」端點掛上 `admin_required`（或統一新的驗證機制，見第 2 點）。釐清 `announcements` / `rules` 哪些是公開讀、哪些是管理寫，只保護寫入。

### 2. 登入 token 是假的，前後端都沒讓它生效
- `backend/app/__init__.py` 的 `/api/auth/admin/login` 回傳 `access_token = f"session_token_admin_{user_id}"`（純字串拼接，非真正簽章 token）。
- `frontend/src/pages/Login.jsx`、`frontend/src/pages/Dashboard.jsx`：前端把它存進 `localStorage`，但呼叫後端時**從不帶上**，後端也**從不驗證**。
- 與第 1 點互為表裡：`admin_required` 目前是讀 `X-Admin-User` header 比對 username，與登入發的 token 完全脫鉤。
- 建議：擇一收斂——(a) 發真正的簽章 token（JWT 或 server session），前端每次請求帶 `Authorization`，後端統一驗證；或 (b) 若維持 demo 等級，至少讓前端帶 `X-Admin-User` 並全面套用 `admin_required`，移除無用的假 token。

### 3. 密碼驗證仍保留明文 fallback 與可疑的 email 自動補字
- `backend/app/__init__.py` 的 `verify_password()`：雜湊比對失敗後會 fallback 成 `input_password == stored_password`（明文比對）。Demo 期可接受，正式上線前應移除，強制全部帳號使用雜湊。
- 同檔 `/api/auth/admin/login`：對不含 `@` 的輸入自動補 `@gmail.com`。此隱性行為易混淆，建議移除或明確記錄於文件。

---

## P2 清理與一致性

### 4. 刪除死空檔（0 行、無人 import）
以下檔案皆為 0 行，且 `Dashboard.jsx` / `App.js` 實際使用的是 `dashboard/` 目錄下的元件，這些頂層檔已無人引用：
- `frontend/src/api/client.js`
- `frontend/src/auth/AuthContext.jsx`
- `frontend/src/pages/DbBrowser.jsx`
- `frontend/src/pages/SyncMonitor.jsx`
- `frontend/src/pages/Users.jsx`

建議：直接刪除。（功能已分別由 `dashboard/` 下的 `TableXxx` / `SyncLog` / `UsersManage` 等取代。）

### 5. 移除舊的 favorites / notifications API
- `backend/app/api/favorites.py`、`backend/app/api/notifications.py`：已被 `backend/app/api/me.py`（`/api/me/*` 整併 API）完全取代，ARCHITECTURE 也已標記為「待移除」。
- 注意：`notifications` **資料表**仍由 `me.py` 與背景推播 `notifier.py` 共用，**只移除這兩支 API blueprint 與其註冊**，不要動資料表。
- 連帶：`__init__.py` 移除 `favorites_bp`、`notifications_bp` 的 import 與註冊。

### 6. 消除通知/收藏查詢的 N+1
- `backend/app/api/me.py` 的 `list_my_stations()`：先查收藏清單，再對每一站逐筆呼叫 `_query_collect_days()` 查 `station_schedules`（N+1）。
- `backend/app/api/notifications.py` 也有相同模式（若第 5 點先刪除此檔則一併解決）。
- 建議：改用單次 `JOIN` 或一次性 `WHERE station_id IN (...)` 批次查回所有收運日，再於記憶體分組。

### 7. 後端回傳格式三套並存，需統一
目前同時存在三種風格，前端要分別處理：
- `app/utils/responses.py` 的 `ok()` / `err()`（多數 API，如 `me.py`、`etl.py`、`bags.py`）。
- `add_delete_route.py` / `add_delete_station.py` 用 `jsonify({"status": "success"/"error", ...})`。
- `__init__.py` 的 db browse / structure 用裸 `jsonify({"error": ...})`。

建議：全面收斂到 `ok()` / `err()`，順帶統一錯誤碼語意（400 參數錯、401 未驗證、403 權限、500 伺服器）。

---

## P3 測試與文件

### 8. 後端完全沒有測試
- 無 `backend/tests/` 目錄。核心邏輯（登入驗證、`me` 收藏/通知 CRUD、db browse 防呆、ETL 來源驗證、geo 查詢）皆無自動化測試。
- 建議：新增 `backend/tests/`，至少覆蓋 auth、me、db browse 邊界（limit/sort/search_fields 防呆）、ETL 欄位驗證。

### 9. 前端測試仍是 CRA 預設，必壞
- `frontend/src/App.test.js`：仍是 Create React App 範本（測 "learn react" 連結），與現有 UI 不符，跑了一定失敗。
- 建議：改寫成登入流程 / Dashboard 切換的實際測試，或先移除以免 CI 卡住。

### 10. 文件與現況脫節，需對齊
- **Port 不一致**：實際 code 已統一在 `8000`（`backend/run.py` 預設 `PORT=8000`、`frontend/src/utils/api.js` 也指 `8000`），但：
  - `README.md` 自相矛盾（同時出現 `--port=5000`、`localhost:5000/health` 與多處 `8000`）。
  - `ARCHITECTURE.md` 第十章仍寫 `localhost:5000/health`。
  - 建議：全部統一成 `8000`（或反向統一，但要一致）。
- **ARCHITECTURE.md 過時段落**：
  - 6.2 節仍描述「`config.py` 保留 `GOOGLE_MAPS_API_KEY`」，但專案已無 `backend/config.py`（改為 `.env` + `os.environ`），此段需更新。
  - 第九章「尚未完成」清單部分已完成（db_admin 空檔等），需重新校對。
- 建議：以目前程式碼為準，重新校對 README 與 ARCHITECTURE。

### 11. 兩份 newimport.py 仍可整併
- `database/newimport.py`（核心實作）與 `backend/app/tasks/newimport.py`（轉接器）關係已釐清，但 ARCHITECTURE 第九章仍列為可再整併項，屬低優先技術債，視需要處理。
