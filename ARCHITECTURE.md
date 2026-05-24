# 北北基垃圾車追蹤平台 — 系統架構文件

> **文件版本**：v2.0（2026-05-23 重整）
> **定位**：本文件以**目前實際的程式碼與資料庫結構為主體**，忠實描述「現況」，並對尚未完成的功能以 **路線圖** 標記為「規劃中／未實作」。

---

## 第一章　專案總覽

「北北基垃圾車追蹤平台」整合台北市、新北市、基隆市三地環保局的開放資料，提供一站式垃圾車清運資訊服務。系統分為**一般使用者**與**管理者**兩種角色。

### 功能需求

**一般使用者**（介面：LINE Bot + LIFF 網頁）
1. LINE 一鍵綁定（免登入、免帳密）
2. 多組「常用清運定點」儲存與切換
3. 查詢定點最快何時有垃圾車抵達
4. 地圖視覺化：顯示**行駛路線與站點**（靜態，**不含即時車輛位置**）
5. 自訂到站前預警時間（如前 5 分鐘推播）
6. 顯示收運日程表
7. 垃圾袋規範資訊
8. 大型廢棄物清運資訊

**管理者**（介面：React 管理後台，需帳密登入）
1. 檢視／維護使用者資料、權限控管、異常帳號停權
2. 監控 Open Data／ETL 同步狀態（抓取成功與否、最後更新時間）
3. 發布並透過 LINE 推播重大環保政策公告（颱風停收、春節異動等）
4. 在後台瀏覽資料庫的內容與結構（DB 瀏覽器：選表 → 分頁／搜尋／排序查看資料列，並檢視欄位結構）

### 介面分工
- **一般使用者**：全程走 **LINE**——Bot 對話 + LIFF 網頁（地圖、日程、收藏、規範與大型廢棄物查詢）。**不使用 React**。
- **管理者**：管理者其實是「`role` 被升為 `admin` 的 LINE 使用者」。使用者先綁定 LINE（`username`＝暱稱），可自助設定 **email + 密碼**；有了 email/密碼後，既有管理者才能把其 `role` 升為 `admin`。管理者在 LINE 會看到後台連結，跳轉到 **React 單頁後台**，用 **email + 密碼**登入，執行使用者管理、同步監控、公告推播與資料庫瀏覽。第一位管理者由人工在 DB 改 `role`。

### 目前已實作 vs. 路線圖

| 功能 | 狀態 |
| :---- | :---- |
| 資料庫 schema（11 張表） | 已建立 |
| 北北基三市靜態資料 ETL 匯入 | 已完成（`newimport.py`） |
| 使用者註冊 API（含 LINE 綁定欄位） | 已實作 |
| LINE Webhook（註冊關鍵字回覆 LIFF 連結） | 已實作 |
| LIFF 註冊頁（Flask 渲染） | 已實作 |
| 站點查詢 / 鄰近搜尋 API | 路線圖（待實作正式版） |
| 收藏 / 通知設定 CRUD API | 路線圖（schema 已備，端點未寫） |
| 地圖視覺化（靜態路線/站點，LIFF 頁） | 路線圖（未開始） |
| 大型廢棄物資訊查詢 | 路線圖（`bulky_waste_info` schema 已備，端點未寫） |
| 環保政策公告 + LINE 推播 | 路線圖（`announcements` schema 已備） |
| 到站通知引擎（`notifier.py`） | 路線圖（空檔） |
| 定時 ETL 排程（`data_sync.py`） | 路線圖（空檔，目前靠手動執行 `newimport.py`） |
| 地理服務模組（`geo_service.py`） | 路線圖（空檔） |
| LINE 服務模組（`line_service.py`） | 路線圖（空檔，推播邏輯暫寫在 webhook 內） |
| **管理員 React 後台 + 帳密登入** | 路線圖（目前 frontend 為 CRA 預設樣板，未開始） |
| 管理：使用者停權 / 權限控管 API | 路線圖（`users.status` schema 已備） |
| 管理：Open Data／ETL 同步監控 | 路線圖（`api_sync_log` schema 已備） |
| 管理：資料庫瀏覽器（內容／結構） | 路線圖（新需求；`/api/db/browse`、`/api/db/structure` 待實作） |
| **即時 GPS 車輛追蹤**（新北每 2 分鐘 API、`truck_locations` 表；含一般垃圾車與回收車） | 不做（範圍外），全面以靜態班表/路線資料為主 |

---

## 第二章　系統整體架構（現況）

```
 一般使用者                          ┌──────────────────────────────────────────┐
┌─────────────┐                     │              Flask 後端 (run.py)            │
│  LINE App   │                     │  create_app() 應用工廠 + flask_cors        │
│  ├ Bot 對話 │────────────────────▶│                                            │
│  └ LIFF 網頁│◀───────────────────▶│  Blueprints:                               │
└─────────────┘                     │   /api/stations  (routes.py)  站點查詢      │
                                    │   /api/users     (users.py)   註冊/帳號     │
 管理者                              │   /api/webhooks  (webhooks.py) LINE 回呼    │
┌─────────────┐                     │   (路線圖) /api/admin 使用者/公告/監控       │
│ React 後台   │────────────────────▶│   /health                      健康檢查      │
│ (帳密登入)   │   JSON / CORS       │                                            │
└─────────────┘                     │  app/db.py  ── PooledDB 連線池 (PyMySQL)    │
                                    └───────────────────┬────────────────────────┘
                                                        │  原生 SQL
                                                        ▼
                                            ┌───────────────────────┐
                                            │   MySQL                │
                                            │   (garbage_database)   │
                                            └───────────────────────┘
                                                        ▲
                                                        │  手動執行（路線圖：APScheduler 定時）
                                            ┌───────────────────────┐
                                            │  ETL: newimport.py     │
                                            │  讀取北北基 CSV → 匯入  │
                                            └───────────────────────┘
```

**設計重點**：
- 後端為**單一 Flask 應用**，以 Blueprint 模組化，未拆微服務。
- 資料存取**不使用 ORM**，全程以 PyMySQL 執行原生 SQL，並透過 DBUtils 連線池管理連線。
- ETL 目前是**獨立腳本手動執行**；定時排程（APScheduler）為路線圖項目。
- **介面分工**：一般使用者走 **LINE（Bot + LIFF）**；管理者走 **React 單頁後台**（帳密登入）。兩者皆透過同一組 Flask REST API 存取資料。

---

## 第三章　技術棧

| 層級 | 技術 | 說明 |
| :---- | :---- | :---- |
| 語言 | Python 3.x | 後端 |
| Web 框架 | Flask 3.0.3 | 應用工廠 + Blueprint |
| 跨域 | Flask-Cors 4.0.0 | 供前端／LIFF 呼叫 |
| 資料庫 | MySQL | 開發以 XAMPP 為主，schema 由 phpMyAdmin 匯出 |
| DB 驅動 | PyMySQL 1.1.0 | 直接執行 SQL，`DictCursor` 回傳字典 |
| 連線池 | DBUtils 3.1.0 | `PooledDB`，最大 10 連線 |
| 排程 | APScheduler 3.10.4 | 已列依賴，**任務尚未實作** |
| LINE | line-bot-sdk 3.11.0 (v3) | Messaging API + Webhook |
| 密碼雜湊 | werkzeug `generate_password_hash` | `password_hash` 可為 `NULL`；有密碼時才使用 |
| ETL | pandas / numpy / mysql-connector-python | `newimport.py` 專用（與線上服務的 PyMySQL 分離） |
| 管理後台前端 | React 19 (create-react-app) | **僅供管理員**；目前為預設樣板，待開發登入與管理頁 |
| 使用者前端 | Flask Jinja + LINE LIFF SDK | 一般使用者介面（註冊頁已實作；地圖等 LIFF 頁待補） |
| 地圖 | Google Maps API | 規劃用於 LIFF 地圖頁（靜態路線/站點），待接入 |

> 註：`mysql-connector-python` 與 `PyMySQL` 兩個驅動並存——前者僅供 ETL 腳本 `newimport.py`，後者供線上 API。兩者讀取的設定不同（見第四章 Config）。

---

## 第四章　後端架構

### 4.1 應用工廠與啟動

- [`run.py`](../backend/run.py)：WSGI 進入點，呼叫 `create_app()`，開發模式跑在 `0.0.0.0:5000`。
- [`app/__init__.py`](../backend/app/__init__.py)：`create_app()` 工廠函式，載入 `Config`、啟用 CORS、註冊三個 Blueprint，並提供 `/health` 健康檢查端點。

### 4.2 資料庫層　[`app/db.py`](../backend/app/db.py)

- 以 `DBUtils.PooledDB` 建立連線池（`maxconnections=10`、`mincached=2`、`blocking=True`）。
- `charset='utf8mb4'`、`cursorclass=DictCursor`。
- 對外只暴露 `get_db_connection()`，各層自行 `with conn.cursor()` 執行 SQL，並負責 `commit()` / `close()`。

### 4.3 API 路由層　[`app/api/`](../backend/app/api/)

| Blueprint | URL 前綴 | 檔案 | 現況 |
| :---- | :---- | :---- | :---- |
| `stations` | `/api/stations` | [routes.py](../backend/app/api/routes.py) | 路線圖：目前為空白 Blueprint 骨架，正式端點待實作 |
| `users` | `/api/users` | [users.py](../backend/app/api/users.py) | 純 JSON API：`POST /register`（綁定寫入，含 `line_user_id`）、`GET /me`、`PUT /credentials`。LIFF 頁 HTML 改由 `pages.py` 的 `GET /liff/<page>` 提供（含 `register`） |
| `line_webhook` | `/api/webhooks` | [webhooks.py](../backend/app/api/webhooks.py) | `POST /line`（驗簽後處理事件；文字訊息回覆並導向 LIFF） |

**已知技術債（路線圖）**：
- `stations` Blueprint 目前無任何端點。實作鄰近搜尋時，邏輯應寫在 `geo_service`，並採用「Bounding Box 預過濾」（經緯度 `BETWEEN`）再做 Haversine——站點 AUTO_INCREMENT 已達 ~175,000，全表掃描會是瓶頸。
- 註冊 API 尚未對密碼長度等做後端驗證（前端有 placeholder 提示 6 位）。

### 4.4 業務邏輯層　[`app/services/`](../backend/app/services/)

- [`geo_service.py`](../backend/app/services/geo_service.py)：**空檔**。預計封裝 Bounding Box + Haversine、鄰近站點推薦。
- [`line_service.py`](../backend/app/services/line_service.py)：**空檔**。預計封裝 LINE 推播、帳號綁定邏輯。

> 目前地理與 LINE 邏輯散落在 API 層；路線圖規劃將其下沉至 services。

### 4.5 背景任務層　[`app/tasks/`](../backend/app/tasks/)

- [`data_sync.py`](../backend/app/tasks/data_sync.py)：**空檔**。預計用 APScheduler 定時執行靜態資料同步。
- [`notifier.py`](../backend/app/tasks/notifier.py)：**空檔**。預計掃描收運日程／使用者通知設定，觸發到站提醒。
- [`newimport.py`](../backend/app/tasks/newimport.py)：ETL 主程式（與 `database/newimport.py` 為同一支的兩份副本，見第六章）。

### 4.6 設定層　[`config.py`](../backend/example_config.py)

> 實際檔名為 `config.py`，需由 `example_config.py` 複製改名（已被 .gitignore 忽略，避免提交金鑰）。

- `DB_CONFIG`（dict）：供 ETL 腳本 `newimport.py` 使用的 MySQL 連線參數。
- `Config`（class）：供 Flask 應用使用，包含：
  - `SQLALCHEMY_DATABASE_URI`（目前無 ORM 使用，可列入待清理）。
  - `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_LIFF_ID`。

---

## 第五章　資料庫架構（實際 Schema）

資料庫名稱 `garbage_database`，引擎 InnoDB，字元集 `utf8mb4`。完整 DDL 見 [`database/garbage_database.sql`](../database/garbage_database.sql)。共 **11 張表**。

### 5.1 ER 關係概覽

```
areas ──┬──< routes ──< stations ──< station_schedules
        └──< stations                stations ──< favorites >── users
                                     stations ──< notifications >── users
                                                  announcements >── users (created_by)

獨立 / 參考表：bag_regulations、bulky_waste_info、api_sync_log
```

### 5.2 各表說明

#### `areas`　行政區劃字典表
將縣市／行政區／里別合併為**單一字典表**（包含「里 village」層級）。

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `areas_id` | INT | PK, AI | 主鍵 |
| `city` | ENUM('台北市','新北市','基隆市') | NOT NULL | 縣市 |
| `district` | VARCHAR(20) | NULL | 行政區 |
| `village` | VARCHAR(50) | NULL | 里別（路線層級為 NULL，站點層級才有值） |
| | | UNIQUE(`city`,`district`,`village`) | 以 `<=>` NULL 安全比對去重 |

#### `routes`　清運路線
| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `route_id` | INT | PK, AI | 主鍵 |
| `areas_id` | INT | FK→areas (RESTRICT) | 路線所屬行政區（區層級） |
| `route_code` | VARCHAR(50) | Index | 原始路線代碼（北：局編；新北：lineid；基隆：編號） |
| `route_name` | VARCHAR(100) | NOT NULL | 路線名稱 |
| `car_number` | VARCHAR(20) | NULL | 車牌（主要來自台北資料） |
| `team` | VARCHAR(50) | NULL | 分隊／班別 |
| `trip_number` | VARCHAR(20) | NULL | 車次／班次 |


#### `stations`　靜態站點
| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `station_id` | INT | PK, AI | 主鍵 |
| `route_id` | INT | FK→routes (CASCADE) | 所屬路線 |
| `areas_id` | INT | FK→areas (RESTRICT) | 所屬里／區 |
| `station_name` | VARCHAR(200) | NOT NULL | 清運點名稱（ETL 已去除縣市/區前綴） |
| `sequence_order` | INT | NULL | 路線停靠順序 |
| `longitude` / `latitude` | DECIMAL(10,7) | Index(`latitude`,`longitude`) | 座標 |
| `arrive_time` / `leave_time` | TIME | Index(arrive) | 表定抵達／離開時間 |
| `stay_type` | VARCHAR(20) | NULL | 停留型態（基隆） |
| `memo` | TEXT | NULL | 備註（新北） |
| `raw_source_id` | VARCHAR(50) | NULL | 原始來源 ID（基隆 stopId） |

#### `station_schedules`　收運日程
採用**「每站每日一列、三個布林欄」**設計：

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `schedule_id` | INT | PK, AI | 主鍵 |
| `station_id` | INT | FK→stations (CASCADE) | 站點 |
| `day_of_week` | TINYINT | UNIQUE(`station_id`,`day_of_week`), Index | **0=日, 1=一 … 6=六** |
| `collects_garbage` | TINYINT(1) | default 0 | 當日收一般垃圾 |
| `collects_recycling` | TINYINT(1) | default 0 | 當日收資源回收 |
| `collects_foodscraps` | TINYINT(1) | default 0 | 當日收廚餘 |

> 查詢「週三收廚餘的站點」：`WHERE day_of_week=3 AND collects_foodscraps=1`。

#### `users`　使用者
| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `user_id` | INT | PK, AI | 主鍵（由系統自動產生流水號，Auto Increment） |
| `username` | VARCHAR(50) | NULL（非唯一） | 顯示名稱；LINE 綁定時帶入 LINE 暱稱。暱稱會重複，故**不設 UNIQUE**（登入唯一性靠 `email`） |
| `email` | VARCHAR(100) | UNIQUE, NULL | 信箱 |
| `password_hash` | VARCHAR(255) | NULL | 帳密型帳號用雜湊欄位（可為 `NULL`） |
| `role` | ENUM('user','developer','admin') | default 'user' | 權限角色（管理後台檢查 `admin`/`developer`） |
| `status` | ENUM('active','suspended') | default 'active', Index | 帳號狀態；管理員停權設為 `suspended`（管理者功能1） |
| `created_at` / `updated_at` | TIMESTAMP | | 建立／更新時間 |
| `line_user_id` | VARCHAR(50) | UNIQUE, NULL | LINE LIFF 綁定 ID（位於 `user_id` 之後；LINE 使用者以此為主要識別） |

> 已於 [garbage_database.sql](../database/garbage_database.sql) 的 `users` 表 `CREATE TABLE` 加入此欄位與 `uk_line_user_id` 唯一索引，與 [users.py](../backend/app/api/users.py) 的註冊邏輯一致。
>
> **既有資料庫請注意**：上述只更新了 DDL 檔。若你的 MySQL 已建表且有資料，需另外執行 ALTER 才會生效：
>
> ```sql
> ALTER TABLE users
>   ADD COLUMN line_user_id VARCHAR(50) NULL AFTER user_id,
>   ADD UNIQUE KEY uk_line_user_id (line_user_id);
> ```

#### `favorites`　收藏定點
| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `fav_id` | INT | PK, AI | 主鍵 |
| `user_id` | INT | FK→users (CASCADE) | |
| `station_id` | INT | FK→stations (CASCADE) | |
| `alias` | VARCHAR(100) | NULL | 自訂別名 |
| `created_at` | TIMESTAMP | | UNIQUE(`user_id`,`station_id`) 防重複收藏 |

#### `notifications`　到站通知設定
可分別開關三種廢棄物，並支援多種推播管道。

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `noti_id` | INT | PK, AI | 主鍵 |
| `user_id` | INT | FK→users (CASCADE) | |
| `station_id` | INT | FK→stations (CASCADE) | |
| `remind_before_mins` | INT | default 10 | 提前提醒分鐘數 |
| `notify_garbage` / `notify_recycling` / `notify_foodscraps` | TINYINT(1) | default 1 | 各類別開關 |
| `is_active` | TINYINT(1) | default 1, Index(`is_active`,`station_id`) | 總開關 |
| `device_token` | VARCHAR(255) | NULL | Web Push 用 |
| `push_method` | ENUM('web','line','email') | default 'web' | 推播管道 |

#### `bag_regulations`　垃圾袋規範
| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `reg_id` | INT | PK, AI | 主鍵 |
| `city` | ENUM('台北市','新北市') | NOT NULL | 縣市（基隆未納入） |
| `bag_size` | VARCHAR(20) | NOT NULL | 規格 |
| `volume_liters` | DECIMAL(5,1) | NULL | 容量（公升） |
| `price` | DECIMAL(5,2) | NULL | 售價 |
| `purchase_locations` | TEXT | NULL | 販售地點 |
| `notes` | TEXT | NULL | 備註 |

#### `bulky_waste_info`　大型廢棄物清運資訊（使用者功能8）
參考型內容，量少、少變動。內容**自由格式**，不拆固定欄位（與 `bag_regulations` 同類設計）。

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `info_id` | INT | PK, AI | 主鍵 |
| `city` | ENUM('台北市','新北市','基隆市') | NOT NULL, Index | 縣市 |
| `title` | VARCHAR(200) | NOT NULL | 標題 |
| `content` | TEXT | NULL | 自由格式內容（純文字或 JSON） |
| `updated_at` | TIMESTAMP | ON UPDATE | 最後更新時間 |

#### `announcements`　環保政策公告（管理者功能3）
營運型資料：內文自由格式（TEXT），外層 metadata 供推播追蹤與查詢。

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `announcement_id` | INT | PK, AI | 主鍵 |
| `title` | VARCHAR(200) | NOT NULL | 標題 |
| `content` | TEXT | NOT NULL | 自由格式內文 |
| `target_city` | ENUM('台北市','新北市','基隆市') | NULL, Index | 推播對象縣市；`NULL` = 全體 |
| `created_by` | INT | FK→users (SET NULL) | 發布的管理員 |
| `is_pushed` | TINYINT(1) | default 0 | 是否已透過 LINE 推播 |
| `pushed_at` | TIMESTAMP | NULL | 推播時間 |
| `created_at` | TIMESTAMP | Index | 建立時間 |

#### `api_sync_log`　Open Data／ETL 同步監控（管理者功能2）
記錄每次資料同步的來源、結果與時間，供後台監控抓取健康度（非即時 GPS）。

| 欄位 | 型別 | 約束 | 說明 |
| :---- | :---- | :---- | :---- |
| `log_id` | INT | PK, AI | 主鍵 |
| `source` | ENUM('TPE','NTPC','KLU') | NOT NULL, Index | 來源（台北/新北/基隆） |
| `status` | ENUM('success','failed','partial') | NOT NULL | 同步結果 |
| `records_affected` | INT | NULL | 影響筆數 |
| `message` | TEXT | NULL | 錯誤訊息或摘要 |
| `started_at` / `finished_at` | TIMESTAMP | Index(finished) | 起訖時間 |

## 第六章　資料來源與 ETL

### 6.1 資料來源（靜態 CSV）

| 縣市 | 檔案 | 分組鍵 | 排程資料來源 |
| :---- | :---- | :---- | :---- |
| 台北市 | `台北市垃圾車清運點位資訊.csv` | 局編,車次,路線,分隊,車號,行政區 | **規則推定**：二/四/六收三類；一/三/五僅一般垃圾 |
| 新北市 | `新北市垃圾車路線.csv` | lineid,linename,city | CSV 內 `garbage{day}`/`recycling{day}`/`foodscraps{day}` 欄（Y/空） |
| 基隆市 | `route_klepb.csv` | 編號,清運路線名稱,班別 | `回收日(星期幾)` 欄解析（逗號分隔，`日`→0） |

> **重要**：新北資料匯入的是**靜態路線/班表 CSV**，不是「每 2 分鐘更新的即時 GPS API」。即時車機追蹤**確定不做**（範圍外）。

### 6.2 ETL 程式　[`newimport.py`](../database/newimport.py)

`GarbageTruckImporter` 類別（mysql-connector-python，批次 commit 每 100 筆）：

- `_get_or_create_area(city, district, village)`：以 `<=>` NULL 安全比對，去重建立 `areas`。
- `_clean_station_name(...)`：移除站名中的縣市/行政區前綴（含台/臺異體字處理）。
- `import_taipei` / `import_new_taipei` / `import_keelung`：各市專屬解析器（轉接器模式）。
- `_insert_schedule(...)`：以 `ON DUPLICATE KEY UPDATE` 寫入 `station_schedules`。
- 時間解析：台北 4 位數字（`HHMM`）、新北/基隆 `HH:MM`。

> **兩份副本注意**：[`database/newimport.py`](../database/newimport.py) 與 [`backend/app/tasks/newimport.py`](../backend/app/tasks/newimport.py) 內容不同步。
> - `database/` 版：`main` 連 `garbage_database`，CSV 路徑加 `database/` 前綴（目前未提交的修改）。
> - `backend/app/tasks/` 版：透過 `config.DB_CONFIG` 取連線，CSV 用相對路徑、會 `chdir` 到腳本目錄。
>
> 建議擇一為準（路線圖：整併為單一 ETL 模組，由 `data_sync.py` 排程呼叫）。

---

## 第七章　LINE 整合

### 7.1 LIFF 註冊流程
1. 使用者在 LINE Bot 輸入「註冊／綁定帳號」。
2. [webhooks.py](../backend/app/api/webhooks.py) 回覆 LIFF 連結 `https://liff.line.me/{LIFF_ID}`。
3. LIFF 開啟註冊頁 `GET /liff/register`（通用路由 [pages.py](../backend/app/api/pages.py) 渲染 [templates/liff/register.html](../backend/app/templates/liff/register.html)、注入 `LIFF_ID`）。
4. 前端 `liff.init()` → `liff.getProfile()` 取得 `userId`、暱稱、頭像（暱稱/頭像**僅供畫面顯示**，不寫入帳號欄位）。
5. 表單送出 `POST /api/users/register`（必填 `line_user_id`；`email` 選填；**不收 username 與密碼**）。
6. 後端以 `line_user_id` 檢查是否已綁定，未綁定則寫入 `users`（`username`／`password_hash` 皆留 `NULL`），由資料庫自動產生 `user_id` 流水號。

### 7.2 Messaging API Webhook
- `POST /api/webhooks/line`：以 `X-Line-Signature` 驗簽（`WebhookHandler`），失敗回 400。
- 文字訊息處理：偵測到註冊關鍵字（`註冊`／`綁定帳號`）時，回覆 LIFF 註冊連結；其餘訊息不回覆。

> 路線圖：將推播邏輯下沉至 `line_service.py`；補上 `notifier.py` 的到站推播（生產者-消費者 + 速率限制）。

---

## 第八章　目錄結構

```
tw-garbage-truck-tracker/
├── backend/
│   ├── app/
│   │   ├── __init__.py            # create_app 工廠
│   │   ├── db.py                  # PooledDB 連線池
│   │   ├── api/
│   │   │   ├── routes.py          # /api/stations
│   │   │   ├── users.py           # /api/users（含 LIFF 註冊）
│   │   │   └── webhooks.py        # /api/webhooks/line
│   │   ├── services/              # 路線圖：geo_service / line_service（空檔）
│   │   ├── tasks/                 # 路線圖：data_sync / notifier（空檔）+ newimport
│   │   ├── templates/liff/*.html    # LIFF 頁（register/map/search…，由 /liff/<page> 提供）
│   │   └── utils/helpers.py       # 路線圖：空檔
│   ├── config.py                  # 由 example_config.py 複製（git 忽略）
│   ├── example_config.py
│   ├── requirements.txt
│   ├── run.py
│   └── backend_architecture.md
├── database/
│   ├── garbage_database.sql             # schema DDL
│   ├── newimport.py               # ETL 主程式
│   └── *.csv                      # 北北基原始資料
├── frontend/                      # 路線圖：React 管理員後台（CRA 預設樣板，待開發登入/管理頁）
└── 架構文件/
    ├── 系統架構文件.md             # ← 本文件（權威）
    └── 資料庫正規化與系統開發規劃.md # 初期設計藍圖（保留參考）
```

---

## 第九章　開發環境與啟動

1. **資料庫**：以 XAMPP 啟動 MySQL，建立名為 **`garbage_database`** 的資料庫（須與 `config.py` 一致），匯入 [`database/garbage_database.sql`](../database/garbage_database.sql)。若已有舊版資料庫，因 schema 已多次調整（`line_user_id`、`status`、`username`/`password_hash` 改可空、新增 `bulky_waste_info`／`announcements`／`api_sync_log`），**建議重建資料庫後重新匯入**。
2. **後端設定**：複製 `backend/example_config.py` 為 `backend/config.py`，填入 DB 與 LINE 金鑰。
3. **安裝依賴**：`pip install -r backend/requirements.txt`。
4. **匯入資料**：於專案根目錄執行 `python database/newimport.py`（CSV 須在 `database/` 下）。
5. **啟動後端**：`python backend/run.py`（`http://localhost:5000`，`/health` 可驗活）。
6. **LINE 本機測試**：以 ngrok 對外，將 Webhook URL 設為 `https://<ngrok>/api/webhooks/line`，LIFF Endpoint 設為註冊頁網址。

---

## 第十章　路線圖（規劃中／未實作）

依優先序：

**使用者端（LINE / LIFF）**
1. **收藏 / 通知 CRUD API**：schema 已備，補 `/api/favorites`、`/api/notifications` 端點。
2. **站點查詢 + `geo_service`**：鄰近搜尋（Bounding Box 預過濾 + Haversine）、定點最快到站時間、收運日程查詢。
3. **到站通知引擎 `notifier.py`**：依 `station_schedules` + `notifications` 觸發 LINE 推播；速率限制與失敗重試。
4. **LIFF 功能頁**：地圖（Google Maps，靜態路線/站點）、收藏管理、垃圾袋規範、大型廢棄物資訊（`bulky_waste_info`）。

**管理者端（React 後台）**
5. **管理員登入機制**：以 **email + 密碼** 登入（`check_password_hash`）、驗證 `role` 為 `admin`/`developer`；登入後請求帶 `X-Admin-User: <email>`。升級流程＝LINE 使用者先自助設 email+密碼，既有管理者再把其 `role` 升為 `admin`；首位人工改 DB。（JWT 列為以後做）
6. **使用者管理 API**：檢視/維護使用者、權限控管、停權（切換 `users.status`）。
7. **公告管理 + 推播**：`announcements` CRUD，並透過 `line_service` 對目標 `target_city`／全體推播。
8. **同步監控頁**：讀取 `api_sync_log` 呈現各來源最後同步狀態與時間。
9. **資料庫瀏覽器（新需求）**：後端 `/api/db/browse`（動態查表，**表名／排序欄位白名單防注入**、`limit` 上限）、`/api/db/structure`（`DESCRIBE`）；前端後台新增「資料庫瀏覽」頁（選表、分頁、搜尋、排序、結構檢視）。
10. **React 後台前端**：登入頁 + 上述管理頁面（取代現有 CRA 樣板）。

**共用 / 基礎**
11. **定時 ETL `data_sync.py`**：APScheduler 排程；整併兩份 `newimport.py`；每次同步寫入 `api_sync_log`。
12. **`line_service.py`**：集中封裝 LINE 推播（reply / push / multicast）。
13. **設定清理**：移除 `Config` 中未使用的 `SQLALCHEMY_*` 欄位。

> **範圍外（明確不做）**：即時 GPS 車輛追蹤（`truck_locations` 表、新北每 2 分鐘 API 抓取、ETA 計算）及據此的車型辨識（一般垃圾車 vs 回收車），均**不納入本專案範圍**。所有到站推播一律以靜態 `station_schedules` 班表為依據。

---

## 第十一章　已知問題與待釐清

| # | 項目 | 影響 | 建議 |
| :---- | :---- | :---- | :---- |
| 1 | `stations` Blueprint 尚無端點 | 站點查詢功能待補 | 於 geo_service 實作鄰近搜尋（Bounding Box + Haversine）後接上 API |
| 2 | 兩份 `newimport.py` 不同步 | ETL 行為不一致 | 整併為單一模組 |
| 3 | `Config.SQLALCHEMY_*` 未使用 | 易誤導（無 ORM） | 清理 |
| 4 | services/tasks/utils 多為空檔 | 邏輯散落 API 層 | 依路線圖逐步下沉 |
| 5 | 尚無登入與權限驗證（管理 API 未受保護） | 管理功能無法安全上線 | 實作管理員登入 + `role`/`status` 檢查中介層 |
| 6 | 基隆 `bag_regulations` 未納入、台北班表為規則推定 | 資料完整度 | 後續補實際資料源 |
| 7 | DB 瀏覽器動態 SQL（表名來自前端） | SQL 注入 / 資料外洩風險 | 表名與排序欄位白名單、`limit` 上限、遮蔽 `password_hash` |
