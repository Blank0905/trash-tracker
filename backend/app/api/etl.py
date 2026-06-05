"""ETL 來源網址管理 API（管理後台用）

讓管理者後台檢視與更新三市開放資料的 CSV 下載網址（存於 etl_sources 表）。
三市固定（TPE/NTPC/KLU），只有 url 可改；filename / encoding / 欄位解析仍寫死在
database/newimport.py 的 SOURCES。更新時會先下載該網址並驗證必要欄位，通過才寫入。

權限：暫比照現有後台端點（未加 admin_required），日後統一處理。
"""
import io
from threading import Thread

import pandas as pd
import requests
from flask import Blueprint, current_app, request

from app.utils.responses import ok, err
from app.db import get_db_connection

bp = Blueprint('etl', __name__, url_prefix='/api/admin/etl')

# 三市顯示名稱、編碼與「驗證用」必要欄位（與 database/newimport.py 的 SOURCES 對齊）
SOURCE_META = {
    'TPE': {
        'name': '台北市',
        'encoding': 'utf-8-sig',
        'required_columns': ['局編', '車次', '路線', '分隊', '車號', '行政區', '地點', '里別', '經度', '緯度', '抵達時間', '離開時間'],
    },
    'NTPC': {
        'name': '新北市',
        'encoding': 'utf-8-sig',
        'required_columns': ['lineid', 'linename', 'city', 'name', 'rank', 'longitude', 'latitude', 'time'],
    },
    'KLU': {
        'name': '基隆市',
        'encoding': 'utf-8-sig',
        'required_columns': ['編號', '清運路線名稱', '班別', '清運點', '順序', '經度', '緯度', '預估到達時間', '預估離開時間'],
    },
}


@bp.route('/sources', methods=['GET'])
def list_sources():
    """列出三市目前的下載網址與最後更新時間。"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT source, url, updated_at FROM etl_sources")
            rows = {r['source']: r for r in cursor.fetchall()}

        data = []
        for code, meta in SOURCE_META.items():
            row = rows.get(code)
            data.append({
                'source': code,
                'name': meta['name'],
                'url': row['url'] if row else None,
                'updated_at': str(row['updated_at']) if row and row['updated_at'] else None,
            })
        return ok(data)

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/sources/<source>', methods=['PUT'])
def update_source(source):
    """更新某市下載網址。body: { url }

    先下載該網址並驗證必要欄位，通過才寫入 etl_sources（壞網址存不進去）。
    """
    source = source.upper()
    meta = SOURCE_META.get(source)
    if not meta:
        return err('來源代碼須為 TPE / NTPC / KLU', 400)

    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    if not url:
        return err('缺少 url', 400)
    if not (url.startswith('http://') or url.startswith('https://')):
        return err('url 需以 http(s):// 開頭', 400)

    # 先下載 + 解析 + 驗證欄位，通過才存
    try:
        resp = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0 (trash-tracker ETL)'})
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.content.decode(meta['encoding'], errors='strict')), dtype=str)
    except Exception as e:
        return err(f'網址無法下載或解析：{e}', 400)

    missing = [c for c in meta['required_columns'] if c not in df.columns]
    if missing:
        return err(f'缺少必要欄位：{", ".join(missing)}', 400)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 三市固定：存在則更新 url、不存在則補插入
            cursor.execute(
                "INSERT INTO etl_sources (source, url) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE url = VALUES(url)",
                (source, url)
            )
            conn.commit()
        return ok({'source': source, 'rows': len(df)})

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/run', methods=['POST'])
def run_etl():
    """手動觸發一次完整 ETL（背景執行：下載三市最新資料 → 匯入 → 寫 api_sync_log）。

    立即回應、不等 ETL 跑完（可能數分鐘）；結果可於 api_sync_log 查看。
    """
    app = current_app._get_current_object()

    def task():
        with app.app_context():
            from app.tasks.data_sync import execute_daily_data_sync
            execute_daily_data_sync()

    Thread(target=task, daemon=True).start()
    return ok({'message': 'ETL 已在背景觸發，完成後可於 api_sync_log 查看結果'})
