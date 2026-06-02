"""簡易版身分驗證（開發 / Demo 用）

- line_required：讀 header `X-Line-User-Id`，對應到 users 中的 LINE 使用者。
- admin_required：讀 header `X-Admin-User`（管理員登入後由前端帶上），
  查 users 且 role 為 admin / developer。

通過後會把使用者資料放進 flask.g（`g.current_user` / `g.current_admin`）。

⚠️ 簡易版：header 可被偽造，僅供開發。安全版（LIFF ID Token 驗證 / JWT）
   見「開發分工與接口規格.md」第 6 節，標記為「以後做」。
"""
from functools import wraps
from flask import request, g
from app.db import get_db_connection
from app.utils.responses import err

# 只允許以下欄位查詢，避免任何 SQL 注入疑慮
_ALLOWED_LOOKUP = {'line_user_id', 'username', 'user_id'}


def find_user(field, value):
    """依指定欄位查單一使用者，回傳 dict 或 None。"""
    if field not in _ALLOWED_LOOKUP:
        raise ValueError(f'不允許以 {field} 查詢使用者')
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT * FROM users WHERE {field} = %s", (value,))
            return cursor.fetchone()
    finally:
        conn.close()


def line_required(f):
    """要求請求帶有有效的 X-Line-User-Id。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        line_user_id = request.headers.get('X-Line-User-Id')
        if not line_user_id:
            return err('缺少 X-Line-User-Id', 401)
        user = find_user('line_user_id', line_user_id)
        if not user:
            return err('使用者尚未綁定', 401)
        if user.get('status') == 'suspended':
            return err('帳號已停權', 403)
        g.current_user = user
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    """要求請求帶有有效的 X-Admin-User，且該使用者為管理員。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        admin_user = request.headers.get('X-Admin-User')
        if not admin_user:
            return err('缺少 X-Admin-User', 401)
        user = find_user('username', admin_user)
        if not user or user.get('role') not in ('admin', 'developer'):
            return err('需要管理員權限', 403)
        if user.get('status') == 'suspended':
            return err('帳號已停權', 403)
        g.current_admin = user
        return f(*args, **kwargs)
    return wrapper
