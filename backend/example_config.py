import os
#記得把檔名改成config.py
# 保留給舊的 ETL 腳本 (newimport.py) 使用
DB_CONFIG = {
    'host': 'localhost',
    'port': '3306',
    'database': 'garbage_database',
    'user': 'root',
    'password': ''
}

class Config:
    # LINE Bot 的金鑰
    LINE_CHANNEL_SECRET = os.environ.get('LINE_CHANNEL_SECRET') or 'LINE_CHANNEL_SECRET'
    LINE_CHANNEL_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN') or 'LINE_CHANNEL_ACCESS_TOKEN'
    LINE_LIFF_ID = os.environ.get('LINE_LIFF_ID') or 'LINE_LIFF_ID'
    LINE_CHANNEL_ID = os.environ.get('LINE_CHANNEL_ID') or ''  # 未來 LIFF ID Token 驗證用
