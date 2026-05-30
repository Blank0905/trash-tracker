"""到站通知設定 API（負責人：P2）

皆需 X-Line-User-Id（line_required）。資料表：notifications。
"""
from flask import Blueprint, request, g
from app.utils.responses import ok, err
from app.utils.auth import line_required
from app.db import get_db_connection

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


@bp.route('/', methods=['GET'])
@line_required
def list_notifications():
    """列出本人通知設定。"""
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    noti_id,
                    station_id,
                    remind_before_mins,
                    notify_garbage,
                    notify_recycling,
                    notify_foodscraps,
                    is_active,
                    push_method
                FROM notifications
                WHERE user_id = %s
                ORDER BY noti_id DESC
                """,
                (g.current_user['user_id'],)
            )

            rows = cursor.fetchall()
            data = []

            for row in rows:
                (
                    noti_id,
                    station_id,
                    remind_before_mins,
                    notify_garbage,
                    notify_recycling,
                    notify_foodscraps,
                    is_active,
                    push_method
                ) = row

                data.append({
                    'noti_id': noti_id,
                    'station_id': station_id,
                    'remind_before_mins': remind_before_mins,
                    'notify_garbage': notify_garbage,
                    'notify_recycling': notify_recycling,
                    'notify_foodscraps': notify_foodscraps,
                    'is_active': is_active,
                    'push_method': push_method
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/', methods=['POST'])
@line_required
def add_notification():
    """新增通知設定。"""
    data = request.get_json(silent=True) or {}

    station_id = data.get('station_id')

    if not station_id:
        return err('缺少 station_id', 400)

    remind_before_mins = data.get('remind_before_mins', 10)
    notify_garbage = data.get('notify_garbage', 1)
    notify_recycling = data.get('notify_recycling', 1)
    notify_foodscraps = data.get('notify_foodscraps', 1)
    push_method = data.get('push_method', 'line')

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO notifications (
                    user_id,
                    station_id,
                    remind_before_mins,
                    notify_garbage,
                    notify_recycling,
                    notify_foodscraps,
                    is_active,
                    push_method
                )
                VALUES (%s, %s, %s, %s, %s, %s, 1, %s)
                """,
                (
                    g.current_user['user_id'],
                    station_id,
                    remind_before_mins,
                    notify_garbage,
                    notify_recycling,
                    notify_foodscraps,
                    push_method
                )
            )

            conn.commit()

            return ok({'noti_id': cursor.lastrowid}, status_code=201)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/<int:noti_id>', methods=['PATCH'])
@line_required
def update_notification(noti_id):
    """更新通知設定。"""
    data = request.get_json(silent=True) or {}

    allowed_fields = [
        'station_id',
        'remind_before_mins',
        'notify_garbage',
        'notify_recycling',
        'notify_foodscraps',
        'is_active',
        'push_method'
    ]

    update_fields = []
    values = []

    for field in allowed_fields:
        if field in data:
            update_fields.append(f"{field} = %s")
            values.append(data[field])

    if not update_fields:
        return err('沒有提供可更新的欄位', 400)

    values.append(noti_id)
    values.append(g.current_user['user_id'])

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            sql = f"""
                UPDATE notifications
                SET {', '.join(update_fields)}
                WHERE noti_id = %s AND user_id = %s
            """

            cursor.execute(sql, values)
            conn.commit()

            if cursor.rowcount == 0:
                return err('找不到通知設定', 404)

            return ok(None)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/<int:noti_id>', methods=['DELETE'])
@line_required
def delete_notification(noti_id):
    """刪除通知設定。"""
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM notifications
                WHERE noti_id = %s AND user_id = %s
                """,
                (noti_id, g.current_user['user_id'])
            )

            conn.commit()

            if cursor.rowcount == 0:
                return err('找不到通知設定', 404)

            return ok(None)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()
