# 北北基垃圾車追蹤平台

整合**台北市 / 新北市 / 基隆市**三市的垃圾車清運開放資料，提供一般使用者透過 LINE Bot + LIFF 查詢附近站點與設定到站提醒，管理者透過 React 後台維護資料、發布公告。

> 完整系統架構、API 規格、資料庫結構請見 **[ARCHITECTURE.md](ARCHITECTURE.md)**。本檔僅作為開發者入門。

---

## 主要功能

**一般使用者（LINE Bot + LIFF）**
- 一鍵綁定 LINE 帳號
- 查詢附近垃圾車站點、預計到站時間
- 收藏定點、設定逐日到站提醒（在站點到達前 N 分鐘推播）
- 查閱垃圾袋規範、大型廢棄物清運法規、系統公告

**管理者（React 後台）**
- 管理使用者（停權 / 升級為管理員）
- 維護路線、站點、班表、垃圾袋規範
- 發布公告（可一鍵 LINE 群發）
- 設定 ETL 來源網址、查看每日同步紀錄
- 直接瀏覽資料庫各表內容與結構

---

## 技術棧

| 層 | 技術 |
|---|---|
| 後端 | Python 3.12、Flask 3、PyMySQL + DBUtils 連線池（無 ORM） |
| 資料庫 | MySQL 8 / MariaDB 10.4（utf8mb4） |
| 排程 | APScheduler（背景執行緒）|
| LINE | line-bot-sdk v3（Messaging API + Webhook + LIFF） |
| 使用者前端 | Jinja2 模板 + 原生 JS + Leaflet / OpenStreetMap |
| 管理前端 | React（Create React App，`frontend/`） |
| ETL | pandas + requests（`database/newimport.py`） |
| 部署 | Docker Compose（db + backend + frontend） |

---

## 本機開發

### 前置需求
- Python 3.12+ 與虛擬環境
- Node.js 18+ 與 npm
- MySQL 8 / MariaDB 10.4（建議用 XAMPP 起 local DB）
- 一個 LINE Developers Console 帳號（測試 webhook 用）
- ngrok（讓 LINE Webhook 能打到本地）

### 1. 資料庫

啟動 MySQL 後匯入 schema 與種子資料：

```bash
mysql -u root -p < database/garbage_database.sql
```

### 2. 後端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate.bat      # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt

# 複製範本並填入金鑰
cp .env.example .env
```

**必填的環境變數**（寫在 `backend/.env`）：

| 變數 | 說明 |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | 資料庫連線 |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API 金鑰 |
| `LINE_LIFF_ID` / `LINE_CHANNEL_ID` | LIFF 設定 |
| **`SECRET_KEY`** | **管理者 token 簽章金鑰，必填強隨機字串**（見下方說明） |

> **⚠️ `SECRET_KEY` 必須設定**：管理者登入後拿到的 token 由 itsdangerous 用此金鑰簽章。若未設定，會 fallback 成 dev key（`'dev-insecure-secret-change-me'`），token 形同虛設、任何人都能偽造。建議用 `python -c "import secrets; print(secrets.token_urlsafe(32))"` 生成。

可選環境變數：
- `HOST`（預設 `0.0.0.0`）、`PORT`（**預設 8000**）、`FLASK_DEBUG`
- `DISABLE_SCHEDULER=1`：停用背景排程（開發時方便）

啟動：

```bash
python run.py
```

啟動後 `http://localhost:8000/health` 應回 `{"status":"ok"}`。

### 3. 前端（React 管理後台）

```bash
cd frontend
npm install
npm start
```

預設開在 `http://localhost:3000`，會自動探測後端位置（公網優先、否則 `localhost:8000`）。

### 4. LINE Webhook（測試 LIFF / Bot 時才需要）

```bash
ngrok config add-authtoken <你的 token>   # 只需設定一次
ngrok http 8000
```

到 LINE Developers Console 設定：
- **Webhook URL** = `https://<ngrok-domain>/api/webhooks/line`
- **LIFF Endpoint URL** = `https://<ngrok-domain>/liff`

---

## Docker 打包與 Oracle Cloud 部署

專案已提供：

- `docker-compose.yml`（MySQL + Backend + Frontend）
- `backend/Dockerfile`、`frontend/Dockerfile`、`frontend/nginx.conf`
- `.env.docker.example`

### 1. 環境變數

```bash
cp .env.docker.example .env
cp backend/.env.example backend/.env
```

至少要調整：
- `.env` 的 `DB_PASSWORD`（用強密碼）
- `.env` 的 `REACT_APP_BACKEND_URL`（改成公網 IP 或網域，例 `http://140.238.xxx.xxx:8000`）
- `backend/.env` 的 `LINE_*` 金鑰與 **`SECRET_KEY`**

### 2. 本機驗證

```bash
docker compose --env-file .env up -d --build
docker compose ps
```

健康檢查：
- Frontend：`http://localhost`
- Backend：`http://localhost:8000/health`

### 3. Oracle Cloud（Compute VM）

1. 建 Ubuntu VM（建議 ARM Ampere A1 或 E4.Flex）
2. 在 VCN Security List / NSG 開放 TCP `22`、`80`、`8000`
3. SSH 進 VM 安裝 Docker 與 Compose Plugin
4. `git clone` 專案
5. 準備好 `.env` 與 `backend/.env`
6. 啟動：

```bash
docker compose --env-file .env up -d --build
```

### 4. 更新 LINE Webhook

部署完成後到 LINE Developers Console 設定：

```
http://<你的 OCI 公網 IP>:8000/api/webhooks/line
```

若需要 HTTPS，請在 VM 前面加一層反向代理（Nginx + Let's Encrypt）或使用 OCI Load Balancer + 憑證。

---

## 目錄結構

```
trash-tracker/
├─ backend/                # Flask 後端
│  ├─ run.py               # 入口
│  └─ app/
│     ├─ __init__.py       # create_app、inline 端點、排程
│     ├─ api/              # 各 Blueprint
│     ├─ services/         # geo / line 服務
│     ├─ tasks/            # 到站推播、ETL 排程
│     ├─ utils/            # auth、responses
│     └─ templates/liff/   # LIFF 使用者頁
├─ frontend/               # React 管理後台
│  └─ src/
│     ├─ pages/            # Login、Dashboard 與子頁
│     └─ utils/api.js      # 後端探測 + authedFetch wrapper
├─ database/
│  ├─ garbage_database.sql # 完整 schema + 種子資料
│  └─ newimport.py         # ETL 核心
├─ ARCHITECTURE.md         # 系統架構（權威文件）
└─ docker-compose.yml
```

詳細說明請見 [ARCHITECTURE.md](ARCHITECTURE.md)。

---

## 開放資料來源

- [臺北市垃圾車點位路線資訊](https://data.gov.tw/dataset/136515)
- [新北市垃圾車路線](https://data.gov.tw/dataset/125664)
- [基隆市環保局垃圾清運相關資料](https://data.gov.tw/dataset/128678)
- [台北市垃圾袋規範](https://www.dep.gov.taipei/News_Content.aspx?n=9D5081C3BFCC977A&sms=6B5660C29DA370A7&s=C7D8C02586900F63)
- [新北市垃圾袋規範](https://www.epd.ntpc.gov.tw/StaticPage/baginfo)

來源網址可由管理後台「ETL 來源設定」即時調整，無需改 code。
