# 北北基垃圾車動態與資源回收整合平台

## 資料來源 (Open Data)

- [臺北市垃圾車點位路線資訊](https://data.gov.tw/dataset/136515)
- [新北市垃圾車路線](https://data.gov.tw/dataset/125664)
- [基隆市環保局垃圾清運相關資料](https://data.gov.tw/dataset/128678)

- [台北市垃圾袋規範](https://www.dep.gov.taipei/News_Content.aspx?n=9D5081C3BFCC977A&sms=6B5660C29DA370A7&s=C7D8C02586900F63)
- [新北市垃圾袋規範](https://www.epd.ntpc.gov.tw/StaticPage/baginfo)

## 本機啟動（測試 LINE webhook）

前置：先啟動 MySQL（XAMPP），且 `backend/.env` 已填入 LINE 金鑰。

### 環境設置

複製 `backend/.env.example` 為 `backend/.env`
填寫 `.env`（DB / LINE）

### 啟動後端

cmd.exe（注意 set 等號兩邊不可有空格、值不加引號）：

```bat
cd backend
..\.venv\Scripts\activate.bat # 不一定要
set DISABLE_SCHEDULER=1 # 不一定要
python run.py
```

啟動後開 http://localhost:8000/health 應回 `{"status":"ok"}`。

### ngrok 對外（連到本地 5000）

```
ngrok config add-authtoken <你的token>   # 只需設定一次
ngrok http 8000
```

### 管理者react啟動

```
npm install
npm start
```

複製 ngrok 顯示的 https 網址，到 LINE Developers Console 設定
Webhook URL = `https://<ngrok-domain>/api/webhooks/line`。

## Docker 打包與 Oracle Cloud 部署

此專案已提供以下檔案：

- `docker-compose.yml`（MySQL + Backend + Frontend）
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `.env.docker.example`

### 1) 在專案根目錄準備環境變數

```bash
cp .env.docker.example .env
cp backend/.env.example backend/.env
```

請至少調整：

- `.env` 的 `DB_PASSWORD`（強密碼）
- `.env` 的 `REACT_APP_BACKEND_URL`（改成 Oracle 公網 IP 或網域，例如 `http://140.238.xxx.xxx:8000`）
- `backend/.env` 的 `LINE_*` 金鑰

### 2) 本機先驗證 Docker 可啟動

```bash
docker compose --env-file .env up -d --build
docker compose ps
```

健康檢查：

- Frontend: `http://localhost`
- Backend: `http://localhost:8000/health`

### 3) Oracle Cloud 建議部署方式（Compute VM）

1. 在 OCI 建立 Ubuntu VM（建議 ARM Ampere A1 或 E4.Flex）。
2. 在 VCN Security List / NSG 開放 TCP `22`, `80`, `8000`。
3. SSH 進 VM 安裝 Docker + Compose Plugin。
4. 把專案拉到 VM（`git clone`）。
5. 建立 `backend/.env` 與根目錄 `.env`。
6. 啟動：

```bash
docker compose --env-file .env up -d --build
```

### 4) 更新 LINE Webhook

部署完成後，將 LINE Developers Console 的 Webhook URL 設成：

`http://<你的OCI公網IP>:8000/api/webhooks/line`

若需要 HTTPS，請在 VM 前面加一層反向代理（Nginx + Let's Encrypt）或使用 OCI Load Balancer + 憑證。
