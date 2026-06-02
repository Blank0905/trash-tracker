# 北北基垃圾車動態與資源回收整合平台

## 資料來源 (Open Data)

- [臺北市垃圾車點位路線資訊](https://data.gov.tw/dataset/136515)
- [新北市垃圾車路線](https://data.gov.tw/dataset/125664)
- [基隆市環保局垃圾清運相關資料](https://data.gov.tw/dataset/128678)

## 本機啟動（測試 LINE webhook）

前置：先啟動 MySQL（XAMPP），且 `backend/config.py` 已填入 LINE 金鑰。

### 環境設置

把 example_config.py 改成config.py 
填寫 config.py 

### 啟動後端

PowerShell：

```powershell
cd backend
..\.venv\Scripts\activate.bat
set DISABLE_SCHEDULER=1
set FLASK_APP=app:create_app
python -m flask run --host=0.0.0.0 --port=5000
```

cmd.exe（注意 set 等號兩邊不可有空格、值不加引號）：

```bat
cd backend
..\.venv\Scripts\activate.bat # 不一定要
set DISABLE_SCHEDULER=1 # 不一定要
python run.py
```

啟動後開 http://localhost:5000/health 應回 `{"status":"ok"}`。

### ngrok 對外（連到本地 5000）

```
ngrok config add-authtoken <你的token>   # 只需設定一次
ngrok http 5000
```

複製 ngrok 顯示的 https 網址，到 LINE Developers Console 設定
Webhook URL = `https://<ngrok-domain>/api/webhooks/line`。