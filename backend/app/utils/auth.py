"""身分驗證

- line_required：讀 header `X-Line-User-Id`，對應到 users 中的 LINE 使用者。
- admin_required：讀 header `Authorization: Bearer <token>`，驗證管理者簽章 token，
  並即時查 users 確認該帳號仍為 admin / developer 且未停權。

token 由 itsdangerous 簽章（內含 user_id、role、簽發時間），可驗真偽與過期，
但**無法被偽造**（需 SECRET_KEY）。供 React 後台登入後使用。

通過後會把使用者資料放進 flask.g（`g.current_user` / `g.current_admin`）。
"""
import os
from functools import wraps

from flask import request, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.db import get_db_connection
from app.utils.responses import err

# 只允許以下欄位查詢，避免任何 SQL 注入疑慮
_ALLOWED_LOOKUP = {'line_user_id', 'username', 'user_id'}

# 管理者 token 設定
ADMIN_TOKEN_MAX_AGE = 7 * 24 * 60 * 60  # 7 天（秒）
_ADMIN_TOKEN_SALT = 'admin-auth'


def _get_serializer():
    """取得 token 簽章器；SECRET_KEY 必須設定，否則 token 形同虛設。"""
    secret = os.environ.get('SECRET_KEY')
    if not secret:
        # 開發用 fallback；正式環境務必在 .env 設定 SECRET_KEY
        secret = 'dev-insecure-secret-change-me'
    return URLSafeTimedSerializer(secret, salt=_ADMIN_TOKEN_SALT)


def generate_admin_token(user):
    """為管理者簽發 token。內含 user_id / role / username。"""
    return _get_serializer().dumps({
        'user_id': user['user_id'],
        'role': user['role'],
        'username': user['username'],
    })


def verify_admin_token(token):
    """驗證 token；成功回傳 payload dict，失敗回傳 None。"""
    try:
        return _get_serializer().loads(token, max_age=ADMIN_TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


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
    """要求請求帶有有效的管理者 token（Authorization: Bearer <token>）。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return err('缺少管理者授權 token', 401)
        token = auth_header[len('Bearer '):].strip()

        payload = verify_admin_token(token)
        if not payload:
            return err('token 無效或已過期，請重新登入', 401)

        # 即時查 DB：確認帳號仍存在、仍為管理員、未被停權（停權可即時生效）
        user = find_user('user_id', payload.get('user_id'))
        if not user or user.get('role') not in ('admin', 'developer'):
            return err('需要管理員權限', 403)
        if user.get('status') == 'suspended':
            return err('帳號已停權', 403)

        # 後台管理路由同時提供 current_user / current_admin，
        # 讓既有 API 與新權限邏輯都能拿到同一份最新使用者資料。
        g.current_user = user
        g.current_admin = user
        return f(*args, **kwargs)
    return wrapper
