"""到站通知設定 API（負責人：P2）

皆需 X-Line-User-Id（line_required）。資料表：notifications。
"""
from flask import Blueprint, request, g
from app.utils.responses import ok, err
from app.utils.auth import line_required
# from app.db import get_db_connection

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


@bp.route('/', methods=['GET'])
@line_required
def list_notifications():
    """列出本人通知設定。
    data: [{ noti_id, station_id, remind_before_mins, notify_garbage,
             notify_recycling, notify_foodscraps, is_active, push_method }]
    """
    # TODO(P2): SELECT * FROM notifications WHERE user_id = g.current_user['user_id']
    return ok([], count=0)


@bp.route('/', methods=['POST'])
@line_required
def add_notification():
    """新增通知設定。
    body: { station_id*, remind_before_mins?=10, notify_garbage?=1,
            notify_recycling?=1, notify_foodscraps?=1, push_method?="line" }
    """
    data = request.get_json(silent=True) or {}
    station_id = data.get('station_id')
    if not station_id:
        return err('缺少 station_id', 400)
    # TODO(P2): INSERT INTO notifications (...)
    return ok({'noti_id': None}, status_code=201)


@bp.route('/<int:noti_id>', methods=['PATCH'])
@line_required
def update_notification(noti_id):
    """更新設定。body: 上述任一欄 + is_active?"""
    data = request.get_json(silent=True) or {}
    # TODO(P2): UPDATE notifications SET ... WHERE noti_id=%s AND user_id=%s
    return ok(None)


@bp.route('/<int:noti_id>', methods=['DELETE'])
@line_required
def delete_notification(noti_id):
    """刪除設定。"""
    # TODO(P2): DELETE FROM notifications WHERE noti_id=%s AND user_id=%s
    return ok(None)
