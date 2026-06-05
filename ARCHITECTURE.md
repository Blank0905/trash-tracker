# 北北基垃圾車追蹤平台 — 系統架構文件

> 文件版本：v2.3（2026-06-05）  
> 文件定位：以目前程式碼實作為準，未實作項目明確標示為「規劃中」。

---

## 第一章　專案總覽

本系統整合台北市、新北市、基隆市的垃圾車靜態資料，提供 LINE 使用者查詢、收藏與通知功能，並保留管理端 API 與後台骨架。

### 1.1 角色與介面

- 一般使用者：LINE Bot + LIFF 頁面（非 React）。
- 管理者：React 後台（目前為骨架）+ 後端 `/api/admin/*`（多數為 TODO）。

### 1.2 目前重點能力

- 站點查詢（鄰近、明細、下一班、路線站點）。
- 使用者綁定與個人資料（LINE 綁定、查自身、設 email/密碼）。
- 收藏 CRUD。
- 到站通知 CRUD（已改為逐星期開關）。
- 收藏＋通知整併 API（`/api/me/*`）：LIFF `me` 頁在收藏站上直接設定逐日通知。
- LINE Webhook（加好友自動綁定 + 關鍵字導向 LIFF）。
- LIFF 通用頁路由與 deep link 入口。
- 背景排程（通知檢查、每日 ETL、快取清理）。

---

## 第二章　啟動與應用入口

### 2.1 `backend/run.py`（thin wrapper）

- 現在僅負責建立 app 與本機啟動：
  - `app = create_app()`
  - `HOST` / `PORT` / `FLASK_DEBUG` 環境變數
- 不再包含業務邏輯，不再硬編碼 LINE 金鑰。

### 2.2 `app:create_app`（主入口）

`backend/app/__init__.py` 目前註冊的 Blueprint（節錄）：

1. `stations`
2. `users`
3. `line_webhook`
4. `favorites` #預計不用了
5. `notifications` #預計不用了
6. `info`
7. `admin`
8. `pages`
9. `me`（收藏＋通知整併）

另提供：

- `GET /health`
- CORS 啟用

### 2.3 背景排程（已實作）

`_start_scheduler()` 已掛載三個任務：

1. 每 60 秒：`check_and_send_notifications`
2. 每日 02:00：`execute_daily_data_sync`
3. 每日 00:05：`clear_expired_notified_set`

可用 `DISABLE_SCHEDULER=1` 停用。

---

## 第三章　後端分層現況

### 3.1 API 路由層（`backend/app/api`）

#### `stations`（已實作）

- `GET /api/stations/search`
- `GET /api/stations/<station_id>`
- `GET /api/stations/<station_id>/next`
- `GET /api/stations/by-route/<route_id>`

邏輯由 `geo_service.py` 提供。

#### `users`（已實作）

- `POST /api/users/register`
- `GET /api/users/me`
- `PUT /api/users/credentials`

#### `line_webhook`（已實作且擴充）

- `POST /api/webhooks/line`
- 已支援 `FollowEvent` 自動綁定與多關鍵字回覆（見第五章）。

#### `favorites`（已實作；⚠️ 舊設計，由 `/api/me/*` 取代，保留待清理）

- `GET/POST/PATCH/DELETE /api/favorites/...`

#### `notifications`（已實作；⚠️ 舊設計，由 `/api/me/*` 取代，保留待清理）

- `GET/POST/PATCH/DELETE /api/notifications/...`
- 已對齊逐星期開關欄位（`notify_d0~notify_d6`）。
- 注意：`notifications` 資料表仍由 `/api/me/*` 與背景推播共用，僅此組 API 不再使用。

#### `info`（已實作）

- `GET /api/info/bag-regulations`
- `GET /api/info/bulky-waste`
- `GET /api/info/announcements`

#### `admin`（骨架）

- 路由已存在，但多數為 TODO。
- `/api/admin/login` 目前回 `501`。
- 其餘多為回空資料或空操作。

#### `pages`（已實作）

- `GET /liff`
- `GET /liff/`
- `GET /liff/<page>`

#### `me`（已實作，整併收藏＋通知）

- `GET /api/me/stations`：列出本人收藏站，每站附 `collect_days`（該站收運星期）與 `notify`（通知狀態，未設為 `null`）。
- `POST /api/me/stations`：新增收藏 `{ station_id, alias? }`。
- `PATCH /api/me/stations/<station_id>`：更新別名 `{ alias }`。
- `DELETE /api/me/stations/<station_id>`：取消收藏，同交易連帶刪除該站通知。
- `PATCH /api/me/stations/<station_id>/notify`：開關／更新通知 `{ is_active?, remind_before_mins?, notify_days? }`；首次建立時逐日預設依該站收運日（有收=1、沒收=0），`remind_before_mins` 預設 5、限 1–60 整數。

供 LIFF `me` 頁使用，取代舊的 `favorites` / `notifications` API。

### 3.2 services 層（`backend/app/services`）

#### `geo_service.py`（已實作）

- `find_nearby_stations`（Bounding Box + Haversine）
- `get_station_detail`
- `next_arrival`
- `list_route_stations`

#### `line_service.py`（已實作）

- `reply_text`
- `push_text`
- `multicast_text`（500 userId 分批）

### 3.3 tasks 層（`backend/app/tasks`）

#### `notifier.py`（已實作）

- 通知判斷已採「逐星期開關 + 當日是否有收運」。
- 透過 `line_service.push_text` 發送。

#### `data_sync.py`（已實作）

- 產生單次任務 `run_id`（UUID）
- 呼叫 ETL 入口，取得逐城市/逐階段結果
- 寫入 `api_sync_log`（每次排程共 6 筆：3 城 download + 3 城 import）

#### `newimport.py`（轉接器）

- 轉呼叫 `database/newimport.py` 的 `run_import()`。

---

## 第四章　資料庫架構（重點）

主要表仍為 11 張：

- `areas`
- `routes`
- `stations`
- `station_schedules`
- `users`
- `favorites`
- `notifications`
- `bag_regulations`
- `bulky_waste_info`
- `announcements`
- `api_sync_log`

### 4.1 `notifications` 重大變更（已落地）

已由「三類型勾選」改為「逐星期開關」：

- 舊欄位（已移除）：`notify_garbage`、`notify_recycling`、`notify_foodscraps`
- 新欄位（已使用）：`notify_d0` ~ `notify_d6`

`day_of_week` 對齊：

- `0=日, 1=一, ... 6=六`

通知判斷邏輯：

1. `notify_d{今天} = 1`
2. 該站今天在 `station_schedules` 有收運
3. 進入提醒時間窗才推送

### 4.2 `api_sync_log` 同步紀錄欄位（已擴充）

- `run_id`：同一次排程任務的關聯鍵（UUID）
- `source`：`TPE` / `NTPC` / `KLU`
- `phase`：`download` / `import`
- `status`：`success` / `failed` / `partial`
- `records_affected`：下載/匯入的筆數（無法計算時為 `NULL`）
- `message`：錯誤訊息或摘要
- `started_at`、`finished_at`：該筆階段的起訖時間

同一個 `run_id` 會對應 6 筆紀錄，方便追蹤單次排程全貌與定位失敗階段。

既有資料庫升級（若表已存在）：

```sql
ALTER TABLE api_sync_log
  ADD COLUMN run_id CHAR(36) NOT NULL AFTER log_id,
  ADD COLUMN phase ENUM('download','import') NOT NULL AFTER source,
  ADD KEY idx_run_id (run_id),
  ADD KEY idx_run_source_phase (run_id, source, phase);
```

---

## 第五章　LINE 與 LIFF 流程

### 5.1 Webhook 行為

- 加好友（`FollowEvent`）：自動綁定 `line_user_id` 到 `users`。
- 舊用戶手動綁定：輸入「綁定」。
- 關鍵字導頁：
  - `綁定信箱` -> `/credentials`
  - `地圖` -> `/map`
  - `查詢` -> `/search`
  - `最愛` / `收藏` -> `/favorites`
  - `通知` / `提醒` -> `/notifications`

### 5.2 LIFF 路由與頁面

現有頁面：

- `index`
- `credentials`
- `favorites`
- `info`
- `search`
- `map`
- `notifications`
- `me`（收藏＋通知整併頁）

已無 `register.html` 註冊頁。

`/liff` 入口已支援 `liff.state` deep link 流程。

---

## 第六章　地圖技術與前端現況

### 6.1 使用者地圖

- 已改為 Leaflet + OpenStreetMap。
- 已支援定位、半徑調整、站點 marker、加入最愛等。
- 不再依賴 Google Maps API 金鑰。

### 6.2 Google Key 注入現況

- `pages.py` 已移除 `google_maps_api_key` 注入。
- `config.py` 仍保留 `GOOGLE_MAPS_API_KEY` 常數（未實際使用，可後續清理）。

### 6.3 管理後台（React）

- 目前仍是開發中骨架，尚未達可上線狀態。
- 實際管理功能（帳密登入、使用者管理、公告推播、同步監控）未完成。

---

## 第七章　ETL 與同步

### 7.1 資料來源

每次 ETL 前會自動從各市開放資料平台下載最新 CSV，**欄位驗證通過後才覆蓋**本地檔（統一存為 UTF-8）：

| 縣市 | 本地檔 | 線上來源（data.gov.tw 資料集） |
|---|---|---|
| 台北市 | `database/台北市垃圾車清運點位資訊.csv` | data.taipei（136515） |
| 新北市 | `database/新北市垃圾車路線.csv` | data.ntpc.gov.tw（125664） |
| 基隆市 | `database/route_klepb.csv` | opendata-kl.askeycloud.com（128678，UTF-8 BOM） |

各來源獨立：某市下載或欄位驗證失敗時，保留該市既有本地檔、其餘照常更新（不會因單一來源掛掉而整批不更新）。寫死的下載網址見 `database/newimport.py` 的 `SOURCES`；市府若改 resource id 需手動更新。

### 7.2 ETL 現況

- `database/newimport.py` 為核心實作；`run_import()` 會先呼叫 `refresh_sources()` 下載並安全覆蓋來源 CSV，再執行三市匯入。
- `run_import()` 會回傳逐城市、逐階段的結果清單（source/phase/status/records_affected/message/started_at/finished_at）。
- `backend/app/tasks/newimport.py` 為轉接載入器。
- `data_sync.py` 會為每次排程建立 `run_id`，再把回傳結果完整寫入 `api_sync_log`。

---

## 第八章　已修正的關鍵問題

1. DictCursor 取值錯誤（favorites/notifications/info）已修正為欄位名取值。
2. `geo_service` 的 PyMySQL cursor 用法已改正（不再用 `dictionary=True`）。
3. `get_station_detail` 的 `areas_id` 連接歧義已修正為明確 `ON` 條件。

---

## 第九章　尚未完成項目（規劃中）

1. `admin.py` 大部分管理功能（目前仍 TODO）。
2. 管理者登入完整機制（目前 `/login` 回 501）。
3. React 管理後台完整頁面與實際串接。
4. DB Browser API（`/api/db/browse`、`/api/db/structure`）。
5. `db_admin.py` 目前空檔。
6. 兩份 `newimport.py` 仍可再整併。
7. 未使用設定（如 `Config.SQLALCHEMY_*`、`GOOGLE_MAPS_API_KEY`）清理。
8. 舊 `favorites` / `notifications` API 已由 `/api/me/*` 取代，待移除。

---

## 第十章　啟動建議（現況）

以後端為例：

1. `cd backend`
2. 啟用虛擬環境
3. `pip install -r requirements.txt`
4. （可選）`DISABLE_SCHEDULER=1`
5. 啟動：
   - `python run.py`，或
   - `FLASK_APP=app:create_app` 後 `python -m flask run`

健康檢查：

- `GET http://localhost:5000/health`

---

## 第十一章　文件維護規則

本文件與實作若有衝突，優先以程式碼為準；每次重大變更應同步更新本文件與 `架構變更對照.md`。
