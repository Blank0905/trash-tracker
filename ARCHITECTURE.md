               # 北北基垃圾車追蹤平台 — 系統架構文件

> 文件版本：v3.0（2026-06-07）
> 文件定位：**以目前程式碼實作為準**。與程式碼衝突時以程式碼為準；尚未完成或已知問題集中在第十一章，細項修復清單見 `TODO_專案修復清單.md`。

---

## 第一章　專案總覽

整合台北市、新北市、基隆市的垃圾車**靜態清運資料**（路線、站點、收運班表、收運時間），提供：

- 一般使用者：透過 **LINE Bot + LIFF 頁面**查詢附近站點、設定收藏與到站通知、查閱垃圾袋/大型廢棄物/公告資訊。
- 管理者：透過 **React 後台**檢視資料庫、管理使用者、維護路線/站點/規範/公告、設定 ETL 來源、查看同步紀錄。

### 1.1 技術棧

| 層 | 技術 |
|---|---|
| 後端 | Python 3.12、Flask 3、PyMySQL + DBUtils 連線池（**無 ORM**） |
| 資料庫 | MySQL 8 / MariaDB 10.4（utf8mb4） |
| 排程 | APScheduler（背景執行緒） |
| LINE | line-bot-sdk v3（Messaging API + Webhook + LIFF） |
| 使用者前端 | Jinja2 模板（`templates/liff/*.html`）+ 原生 JS + Leaflet/OpenStreetMap |
| 管理前端 | React（Create React App，`frontend/`） |
| ETL | pandas + requests（`database/newimport.py`） |
| 部署 | Docker Compose（db + backend + frontend） |

### 1.2 角色與身分

`users.role` 有三種：`user` / `developer` / `admin`；`users.status` 為 `active` / `suspended`。

- 一般使用者免帳密，以 `line_user_id` 為核心識別，加好友時自動建立。
- 管理者需綁定 email + 密碼，且 `role` 為 `admin`，才能登入 React 後台。

> ⚠️ **安全現況**：管理端 API 目前**沒有實際的身分驗證保護**（詳見 3.4 與第十一章）。`app/utils/auth.py` 已備有 `admin_required` 裝飾器但尚未套用。本系統目前僅適合在受控環境 / Demo 使用。

---

## 第二章　目錄結構

```
trash-tracker/
├─ backend/
│  ├─ run.py                  # 入口 thin wrapper（create_app + app.run）
│  ├─ requirements.txt
│  ├─ .env / .env.example     # DB 與 LINE 金鑰（.env 不進版控）
│  ├─ Dockerfile
│  ├─ scripts/
│  │  └─ setup_rich_menu.py   # 一次性建立 LINE 圖文選單
│  └─ app/
│     ├─ __init__.py          # create_app；含 health / db / 管理登入等 inline 端點 + 排程
│     ├─ db.py                # 連線池、ALLOWED_TABLES、DB Browser 查詢
│     ├─ api/                 # 各 Blueprint（見第三章）
│     ├─ services/            # geo_service、line_service
│     ├─ tasks/               # notifier、data_sync、newimport（轉接器）
│     ├─ utils/               # auth、responses、helpers
│     └─ templates/liff/      # LIFF 使用者頁（Jinja2）
├─ frontend/                  # React 管理後台
│  └─ src/
│     ├─ App.js               # 登入 / Dashboard 切換
│     ├─ pages/
│     │  ├─ Login.jsx
│     │  ├─ Dashboard.jsx     # 後台主框架（側欄 + 內容調度）
│     │  └─ dashboard/        # 各資料表檢視與管理元件
│     └─ utils/api.js         # 後端 URL 探測
└─ database/
   ├─ garbage_database.sql        # 完整 schema + 種子資料
   ├─ migrate_bag_regulations.sql # 垃圾袋規範遷移
   ├─ newimport.py                # ETL 核心（下載 + 匯入三市）
   └─ *.csv                       # 三市來源資料本地檔
```

---

## 第三章　後端應用入口與 API

### 3.1 `backend/run.py`

純入口包裝：`app = create_app()`，本機啟動讀 `HOST`（預設 `0.0.0.0`）、`PORT`（**預設 8000**）、`FLASK_DEBUG`。

### 3.2 `app:create_app`（`backend/app/__init__.py`）

啟動時：

1. 載入 `backend/.env`（須早於 `import app.db`）。
2. 註冊自訂 `CustomJSONProvider`：自動把 `Decimal` → float、`date/datetime` → ISO 字串、`timedelta` → `HH:MM:SS`。
3. 啟用 CORS（全開放）。
4. 定義數個 **inline 端點**（見 3.3）。
5. 註冊 14 個 Blueprint（見 3.4）。
6. 啟動背景排程（見第五章），可用 `DISABLE_SCHEDULER=1` 停用。

### 3.3 `__init__.py` 內的 inline 端點

| 方法 | 路徑 | 說明 | 保護 |
|---|---|---|---|
| GET | `/health` | 健康檢查 | 公開 |
| GET | `/api/db-status` | 回傳 DB 連線狀態 | 公開 |
| GET | `/api/db/browse` | DB Browser：分頁/搜尋/排序瀏覽任一允許資料表 | ⚠️ 無 |
| GET | `/api/db/structure` | 取得資料表欄位結構 | ⚠️ 無 |
| POST | `/api/auth/admin/login` | 管理者帳密登入 | 公開 |

管理者登入邏輯：以 email 查 `users`（不含 `@` 會自動補 `@gmail.com`），用 `verify_password()` 驗證（先試 `check_password_hash`，失敗再退回明文比對），通過且 `role == 'admin'` 才回傳 `access_token`（目前是 `session_token_admin_{user_id}` 字串，**非簽章 token，後端不驗證**）。

### 3.4 已註冊的 Blueprint 與端點

> 保護欄位：「公開」= 不需身分；「LINE」= `@line_required`（讀 `X-Line-User-Id`）；「⚠️ 管理（無保護）」= 用途為管理但目前未掛任何驗證。

#### `stations`（`api/routes.py`，`/api/stations`）— 公開
- `GET /search`：附近站點（`lat`、`lng`、`radius` 預設 2km、`limit` 預設 20 上限 200）
- `GET /<station_id>`：站點明細
- `GET /<station_id>/next`：下一班到站
- `GET /by-route/<route_id>`：整條路線的站點

邏輯在 `services/geo_service.py`。

#### `users`（`api/users.py`，`/api/users`）
- `POST /register`：LINE 一鍵綁定（公開）
- `GET /me`：查本人資料（LINE）
- `PUT /credentials`：設定本人 email + 密碼（LINE）
- `GET /list`：所有使用者清單（⚠️ 管理，前端 `UsersManage` 用）
- `POST /promote`：升級為 admin（需已綁 email+密碼）（⚠️ 管理）
- `POST /suspend`：停權使用者（禁止停權其他 admin）（⚠️ 管理）

#### `line_webhook`（`api/webhooks.py`，`/api/webhooks`）— 公開（LINE 簽章驗證）
- `POST /line`：LINE Webhook 入口（見第六章）

#### `info`（`api/info.py`，`/api/info`）— 公開
- `GET /bag-regulations`（可帶 `city`）
- `GET /bulky-waste`（可帶 `city`）
- `GET /announcements`（可帶 `city`，未帶只回全體公告）

#### `me`（`api/me.py`，`/api/me`）— LINE　**目前 LIFF 收藏/通知的正式 API**
- `GET /stations`：本人收藏站清單，每站附 `collect_days`（該站收運星期）與 `notify`（通知狀態，未設為 `null`）
- `POST /stations`：新增收藏 `{ station_id, alias? }`
- `PATCH /stations/<station_id>`：改別名
- `DELETE /stations/<station_id>`：取消收藏（同交易連帶刪通知）
- `PATCH /stations/<station_id>/notify`：開關/更新通知 `{ is_active?, remind_before_mins?, notify_days? }`；首次建立逐日預設依該站收運日，`remind_before_mins` 預設 5、限 1–60

#### `favorites`（`api/favorites.py`，`/api/favorites`）— LINE　⚠️ 舊設計，已被 `me` 取代，待移除
#### `notifications`（`api/notifications.py`，`/api/notifications`）— LINE　⚠️ 舊設計，已被 `me` 取代，待移除
> 注意：`favorites` / `notifications` **資料表**仍由 `me` API 與背景推播共用；只有這兩支 API blueprint 不再使用。

#### `rules`（`api/rules.py`，`/api/rules`）
- `GET /get?city=`：讀某市大型廢棄物法規（取 `bulky_waste_info`，查無回空白範本）（公開）
- `POST /update`：更新/新增某市法規（⚠️ 管理）

#### `announcements`（`api/announcements.py`，`/api/announcements`）
- `GET /list`：公告清單（⚠️ 管理）
- `POST /create`：建立公告（⚠️ 管理）
- `POST /update/<anno_id>`：修改公告（⚠️ 管理）
- `POST /push/<anno_id>`：透過 LINE 群發公告（⚠️ 管理）
> 群發依賴 `line_service`；若 import 失敗會 fallback 成 `MockLineService`（只印 log 不真送），避免 500。

#### `bags`（`api/bags.py`，`/api/admin/bag-regulations`）— ⚠️ 管理
- `POST /`（即 `/api/admin/bag-regulations`）：新增垃圾袋規範（city 限台北市/新北市）
- `PUT /<reg_id>`：更新
- `DELETE /<reg_id>`：刪除
> 讀取仍走公開的 `GET /api/info/bag-regulations`。

#### `add_delete_route`（`api/add_delete_route.py`，`/api/admin/routes`）— ⚠️ 管理
- `GET /list`（可篩 `city`/`district`/`route_name`）、`GET /areas/all`、`GET /areas/village-null`
- `POST /create`、`POST|DELETE /delete/<route_id>`

#### `add_delete_station`（`api/add_delete_station.py`，`/api/admin/stations`）— ⚠️ 管理
- `GET /list`
- `POST /create`、`POST|PUT /update/<station_id>`、`POST|DELETE /delete/<station_id>`
> 新增/更新會驗證序位連續、抵達時間需晚於前站駛離、駛離需早於後站抵達。

#### `etl`（`api/etl.py`，`/api/admin/etl`）— ⚠️ 管理
- `GET /sources`：列三市目前下載網址與更新時間
- `PUT /sources/<source>`：更新某市 url（會先下載驗證必要欄位才寫入 `etl_sources`）
- `POST /run`：背景觸發一次完整 ETL

#### `pages`（`api/pages.py`）— 公開
- `GET /liff`、`GET /liff/`、`GET /liff/<page>`：渲染 `templates/liff/<page>.html` 並注入 `liff_id`（見第六章）

### 3.5 回應格式（不一致，待統一）

目前三種風格並存：
- `app/utils/responses.py` 的 `ok()` / `err()` → `{status, data, ...}` / `{status, message}`（多數 API）
- `add_delete_*` / `users` 管理端 / `rules` 用裸 `jsonify({"status": "success"/"error", ...})`
- `__init__.py` 的 DB Browser 用 `jsonify({"error": ...})`

新程式碼請優先採用 `ok()` / `err()`。

---

## 第四章　資料存取層（`app/db.py`）

- PyMySQL + DBUtils `PooledDB` 連線池（maxconnections=10、mincached=2、DictCursor、連線時 `SET time_zone='+08:00'`），DB 設定全讀環境變數。
- `ALLOWED_TABLES` 白名單 12 張表 + 各表 `PRIMARY_KEYS`；DB Browser 僅允許白名單內資料表。
- `browse_table()` 防呆：`page`/`limit` 夾範圍（limit 上限 500）、`search_fields` 與 `sort` 欄位/方向皆比對欄位白名單，非法即丟錯；`users` 表的 `password_hash` 一律遮成 `***`。

---

## 第五章　背景排程（`_start_scheduler`）

APScheduler（`timezone="Asia/Taipei"`），背景執行緒內自行 push app context：

| 任務 | 觸發 | 函式 |
|---|---|---|
| 到站推播 | 每 60 秒 | `tasks/notifier.check_and_send_notifications` |
| 每日 ETL | 每日 02:00 | `tasks/data_sync.execute_daily_data_sync` |
| 去重快取清理 | 每日 00:05 | `tasks/notifier.clear_expired_notified_set` |

### 5.1 到站推播 `notifier.py`
1. 以台灣時區算今天的 `day_of_week`（Python weekday 轉成 DB 的 0=日…6=六）。
2. 撈 `is_active=1`、使用者 `active`、且 `notify_d{今天}=1` 的通知。
3. 確認該站今天在 `station_schedules` 有收運（並取收運種類）。
4. 現在時間落在 `[arrive_time - remind_before_mins, arrive_time]` 才推播。
5. 以記憶體 `notified_set`（noti_id + 日期）做單程序去重，避免 60 秒重複推。

### 5.2 services
- `geo_service.py`：`find_nearby_stations`（Bounding Box + Haversine）、`get_station_detail`、`next_arrival`、`list_route_stations`。
- `line_service.py`：單例 `line_service`，動態讀 `LINE_CHANNEL_ACCESS_TOKEN`；提供 `reply_text`、`push_text`、`multicast_text`、`multicast_messages`、`multicast_flex`（multicast 自動 500 筆分批）。

---

## 第六章　LINE 與 LIFF

### 6.1 Webhook（`api/webhooks.py`）
- `FollowEvent`（加好友）：自動抓暱稱並綁定 `line_user_id` 到 `users`，回歡迎訊息。
- 文字訊息關鍵字導頁（回 LIFF 連結 `https://liff.line.me/{LIFF_ID}/<page>`）：
  - `綁定` → 手動綁定
  - `綁定信箱` → `/credentials`
  - `地圖` → `/map`
  - `查詢` → `/search`
  - `最愛`/`收藏` → `/favorites`　⚠️ 對應模板不存在（見 6.2）
  - `通知`/`提醒` → `/notifications`　⚠️ 對應模板不存在（見 6.2）

### 6.2 LIFF 頁面（`templates/liff/`）

實際存在的模板：`index`、`credentials`、`map`、`search`、`me`、`bag`、`bulky`。

- `/liff` 入口沿用 `index.html`，載入 LIFF SDK，`liff.init()` 後依 `liff.state` deep link 自動重導到子頁。
- `me.html` 為收藏＋通知整併頁（呼叫 `/api/me/*`）。
- ⚠️ **不一致**：Webhook 仍導向 `/favorites`、`/notifications`，但這兩支模板已不存在（會 404）；功能實際整併在 `me` 頁。此為待修項。

### 6.3 地圖
- 使用 **Leaflet + OpenStreetMap**（`map.html`），免 API key。支援定位、半徑調整、站點 marker、路線繪製、加入收藏。
- 已**不再依賴 Google Maps**；`pages.py` 不再注入任何地圖金鑰。

---

## 第七章　資料庫架構

12 張表（utf8mb4），由 `database/garbage_database.sql` 建立並附種子資料（垃圾袋規範、`etl_sources` 三市網址）。

| 表 | 主鍵 | 用途 |
|---|---|---|
| `areas` | areas_id | 縣市/行政區/里（city+district+village UNIQUE） |
| `routes` | route_id | 清運路線（FK areas_id） |
| `stations` | station_id | 站點（FK route_id、areas_id；含 sequence_order、經緯度、arrive_time/leave_time） |
| `station_schedules` | schedule_id | 站點逐日收運班表（FK station_id；station_id+day_of_week UNIQUE） |
| `users` | user_id | 使用者（line_user_id/username/email 皆 UNIQUE；role、status） |
| `favorites` | fav_id | 收藏（FK user_id、station_id；user+station UNIQUE） |
| `notifications` | noti_id | 到站通知（FK user_id、station_id；notify_d0~d6） |
| `bag_regulations` | reg_id | 垃圾袋規範（台北/新北） |
| `bulky_waste_info` | info_id | 大型廢棄物資訊/法規 |
| `announcements` | announcement_id | 公告（target_city NULL=全體；is_pushed） |
| `api_sync_log` | log_id | ETL 同步紀錄（run_id 關聯一次排程） |
| `etl_sources` | source | 三市 CSV 下載網址（可由後台改 url） |

### 7.1 `day_of_week` 對齊
`0=日, 1=一, …, 6=六`。通知與班表皆依此對齊。

### 7.2 `notifications`（逐星期開關）
- 欄位 `notify_d0`~`notify_d6`（預設 1），取代早期的「三類型勾選」設計。
- 通知判斷：`notify_d{今天}=1` 且該站今天有收運 且 在提醒時間窗內。

### 7.3 `api_sync_log`（同步紀錄）
- `run_id`（UUID，關聯同一次排程）、`source`（TPE/NTPC/KLU）、`phase`（download/import）、`status`（success/failed/partial）、`records_affected`、`message`、`started_at`、`finished_at`。
- 一次排程通常產生 6 筆（3 城 × download/import），便於定位失敗階段。

---

## 第八章　ETL 與同步

### 8.1 來源（`database/newimport.py` 的 `SOURCES`）

| 縣市 | 本地檔 | 線上來源 |
|---|---|---|
| 台北市（TPE） | `台北市垃圾車清運點位資訊.csv` | data.taipei |
| 新北市（NTPC） | `新北市垃圾車路線.csv` | data.ntpc.gov.tw |
| 基隆市（KLU） | `route_klepb.csv` | opendata-kl.askeycloud.com |

- 下載網址在資料庫 `etl_sources` 表（可由後台 `PUT /api/admin/etl/sources/<source>` 修改）；但 `filename`、`encoding`、欄位解析仍寫死在 `SOURCES`。
- `refresh_sources()`：逐市下載，**欄位驗證通過才覆蓋**本地 CSV（統一 UTF-8）；各市獨立，單市失敗不影響其他市。

### 8.2 流程
1. `data_sync.execute_daily_data_sync()` 產生 `run_id` → 呼叫 `run_import()`。
2. `run_import()`（`database/newimport.py`，經 `app/tasks/newimport.py` 動態載入轉接）先 `refresh_sources()` 下載，再三市匯入，回傳逐城市/逐階段結果。
3. `data_sync` 將結果正規化後 `executemany` 寫入 `api_sync_log`。

---

## 第九章　管理後台（React，`frontend/`）

- `App.js`：以 `localStorage.access_token` 是否存在切換 `Login` / `Dashboard`（**前端僅靠 localStorage 判斷，token 不帶給後端、後端也不驗**）。
- `Login.jsx`：打 `POST /api/auth/admin/login`，成功存 `access_token`/`admin_email`/`admin_id`。
- `Dashboard.jsx`：側欄 + 內容調度，輪詢 `/api/db-status` 顯示連線燈號。功能區塊：
  - **顯示資料表**：`dashboard/TableXxx.jsx`（各表唯讀檢視，走 `/api/db/browse`、`/api/db/structure`）
  - **管理使用者** `UsersManage`（`/api/users/list|promote|suspend`）
  - **新增與刪除面板** `ActionAddDelete`（`/api/admin/routes`、`/api/admin/stations`）
  - **規則與公告** `RulesAnnouncements`（`/api/rules`、`/api/announcements`）
  - **ETL 來源設定** `EtlSources`（`/api/admin/etl/sources`）
  - **API 同步紀錄** `SyncLog`（`api_sync_log`）
- `utils/api.js`：`getBackendUrl()` 優先用 `REACT_APP_BACKEND_URL`，否則探測公網/本機（目前硬編在 `:8000`）。

> 死檔（0 行、無人引用，待刪）：`src/api/client.js`、`src/auth/AuthContext.jsx`、`src/pages/{DbBrowser,SyncMonitor,Users}.jsx`。

---

## 第十章　設定與部署

### 10.1 環境變數（`backend/.env`，範本見 `.env.example`）
- DB：`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`
- LINE：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_LIFF_ID`、`LINE_CHANNEL_ID`
- 其他：`HOST`、`PORT`（預設 8000）、`FLASK_DEBUG`、`DISABLE_SCHEDULER`

> 已無 `backend/config.py`，所有設定改由 `.env` + `os.environ` 提供。

### 10.2 本機啟動（後端）
1. `cd backend`，啟用虛擬環境，`pip install -r requirements.txt`
2. 備妥 `.env`，匯入 `database/garbage_database.sql`
3. （可選）`DISABLE_SCHEDULER=1`
4. `python run.py`（或 `FLASK_APP=app:create_app` 後 `python -m flask run`）
5. 健康檢查：`GET http://localhost:8000/health`

### 10.3 Docker Compose
- `db`（mysql:8，時區 +08:00，啟動時自動匯入 schema）、`backend`（埠 8000）、`frontend`（埠 80，build 時注入 `REACT_APP_BACKEND_URL`）。

> **埠統一為 8000**（`run.py` 預設、`docker-compose`、`frontend/utils/api.js` 一致）。部分文件（README、舊版本）可能殘留 5000，以本文件與程式碼為準。

---

## 第十一章　已知問題與待辦

詳細修復步驟見 `TODO_專案修復清單.md`，重點：

1. **管理端 API 無身分驗證**（最大破口）：`/api/db/*`、`/api/admin/*`、`users` 管理端、`announcements`/`rules` 寫入等皆裸露；`admin_required` 已備未用。
2. **登入 token 是假的**：前端存而不帶、後端不驗，需收斂為真正機制或全面套用 `admin_required`。
3. **密碼明文 fallback** 與 email 自動補 `@gmail.com` 的隱性行為，上線前應移除。
4. **舊 `favorites` / `notifications` API 待移除**（已被 `me` 取代）；連帶可消除 `me`/`notifications` 的 N+1 查詢。
5. **回應格式三套並存**，待統一為 `ok()`/`err()`。
6. **Webhook 導向 `/favorites`、`/notifications` 但模板不存在**，需改導向 `me` 或補頁。
7. **前端死空檔**待刪；**前後端皆缺測試**（`App.test.js` 仍為 CRA 範本）。
8. 兩份 `newimport.py` 可再整併（低優先）。

---

## 第十二章　文件維護規則

本文件與實作衝突時以程式碼為準。每次重大變更（新增/移除 API、改 schema、改部署）應同步更新本文件；未完成項目請集中於第十一章並對應到 `TODO_專案修復清單.md`。
