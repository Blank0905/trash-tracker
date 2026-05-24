"""管理後台 API（負責人：P3）

除 /login 外皆需 X-Admin-User（admin_required）。
登入＝簡易版：帳密查 DB（check_password_hash），不發 token。
安全版（JWT）見「開發分工與接口規格.md」第 6 節，標記「以後做」。
"""
from flask import Blueprint, request
from app.utils.responses import ok, err
from app.utils.auth import admin_required
# from werkzeug.security import check_password_hash
# from app.db import get_db_connection
# from app.services import line_service

bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@bp.route('/login', methods=['POST'])
def login():
    """管理員登入。body: { username*, password* }
    成功 data: { user_id, username, role }；失敗或非管理員回 401。
    """
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return err('缺少帳號或密碼', 400)
    # TODO(P3): 查 users WHERE username=%s AND role IN ('admin','developer')
    #           用 check_password_hash(user['password_hash'], password) 驗證；
    #           失敗回 err('帳號或密碼錯誤', 401)
    return err('登入功能尚未實作', 501)


@bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    """使用者列表。query: status?, role?, q?（關鍵字）
    data: [{ user_id, line_user_id, username, email, role, status, created_at }]
    """
    # TODO(P3): SELECT ... FROM users [WHERE 篩選]
    return ok([], count=0)


@bp.route('/users/<int:user_id>', methods=['PATCH'])
@admin_required
def update_user(user_id):
    """更新使用者。body: { role?, status? }（status='suspended' 即停權）"""
    data = request.get_json(silent=True) or {}
    # TODO(P3): UPDATE users SET role=?, status=? WHERE user_id=?
    return ok(None)


@bp.route('/announcements', methods=['GET'])
@admin_required
def list_announcements():
    """全部公告（含未推播）。"""
    # TODO(P3): SELECT * FROM announcements ORDER BY created_at DESC
    return ok([], count=0)


@bp.route('/announcements', methods=['POST'])
@admin_required
def create_announcement():
    """新增公告。body: { title*, content*, target_city? }（target_city 省略=全體）"""
    data = request.get_json(silent=True) or {}
    if not data.get('title') or not data.get('content'):
        return err('缺少 title 或 content', 400)
    # TODO(P3): INSERT INTO announcements (title, content, target_city, created_by) ...
    return ok({'announcement_id': None}, status_code=201)


@bp.route('/announcements/<int:announcement_id>', methods=['PATCH'])
@admin_required
def update_announcement(announcement_id):
    """編輯公告。body: { title?, content?, target_city? }"""
    data = request.get_json(silent=True) or {}
    # TODO(P3): UPDATE announcements SET ... WHERE announcement_id=?
    return ok(None)


@bp.route('/announcements/<int:announcement_id>', methods=['DELETE'])
@admin_required
def delete_announcement(announcement_id):
    """刪除公告。"""
    # TODO(P3): DELETE FROM announcements WHERE announcement_id=?
    return ok(None)


@bp.route('/announcements/<int:announcement_id>/push', methods=['POST'])
@admin_required
def push_announcement(announcement_id):
    """依 target_city 對綁定使用者群發 LINE，並標記 is_pushed/pushed_at。
    data: { sent_count }
    """
    # TODO(P3): 取對象 line_user_id（target_city 為 NULL→全體）→ line_service.multicast_text(...)
    #           UPDATE announcements SET is_pushed=1, pushed_at=NOW()
    return ok({'sent_count': 0})


@bp.route('/sync-log', methods=['GET'])
@admin_required
def sync_log():
    """ETL/Open Data 同步紀錄。query: source?, limit?=50
    data: [{ log_id, source, status, records_affected, message, started_at, finished_at }]
    """
    # TODO(P3): SELECT * FROM api_sync_log [WHERE source=%s] ORDER BY finished_at DESC LIMIT %s
    return ok([], count=0)
