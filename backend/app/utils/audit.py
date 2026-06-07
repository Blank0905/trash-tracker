"""管理者操作審計紀錄

寫入到 admin_audit_log 表（schema 見 database/migrate_admin_audit_log.sql）。
僅在 @admin_required 端點內呼叫；actor 從 flask.g.current_admin 取得。

使用情境：
1. 同 transaction 寫入（推薦）：傳入既有 cursor，與業務動作一起 commit；
   業務動作 rollback 時 log 也跟著 rollback，保持一致。
2. 自開連線寫入：背景觸發的端點（如 etl/run）主路徑沒 cursor 可用時使用。
   開新連線、立即 commit、與業務動作獨立。

寫 log 本身失敗時會 raise（同 transaction 模式下會連帶業務動作 rollback）。
這是刻意設計：寧可整個動作失敗，也不能讓敏感操作沒留下紀錄。
"""
import json

from flask import g, request

from app.db import get_db_connection


_INSERT_SQL = """
    INSERT INTO admin_audit_log
        (actor_user_id, actor_email, action, target_type, target_id, details, ip_address)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
"""


def _build_params(action, target_type, target_id, details):
    admin = g.current_admin
    return (
        admin['user_id'],
        admin.get('email'),
        action,
        target_type,
        target_id,
        json.dumps(details, ensure_ascii=False) if details is not None else None,
        request.remote_addr,
    )


def write_audit_log(action, *, target_type=None, target_id=None, details=None, cursor=None):
    """寫一筆 audit log。

    Args:
        action: 動作識別字串（例：'user_promote'、'announcement_push'）
        target_type: 對象類別（例：'user'、'announcement'）
        target_id: 對象 ID
        details: 補充內容 dict（會以 JSON 存）
        cursor: 若提供，用此 cursor 寫入（同 transaction）；
                若不提供，自開連線、立即 commit。
    """
    params = _build_params(action, target_type, target_id, details)

    if cursor is not None:
        cursor.execute(_INSERT_SQL, params)
        return

    conn = get_db_connection()
    try:
        with conn.cursor() as c:
            c.execute(_INSERT_SQL, params)
        conn.commit()
    finally:
        conn.close()
