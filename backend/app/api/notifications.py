"""到站通知設定 API（負責人：P2）

皆需 X-Line-User-Id（line_required）。資料表：notifications。
通知改為「逐星期」：notify_d0~d6 對應 day_of_week（0=日…6=六），不再分垃圾類別。
"""
from flask import Blueprint, request, g
from app.utils.responses import ok, err
from app.utils.auth import line_required
from app.db import get_db_connection

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

# 7 天的通知開關欄位，對齊資料庫 day_of_week（0=日…6=六）
DAY_COLS = [f'notify_d{d}' for d in range(7)]


@bp.route('/', methods=['GET'])
@line_required
def list_notifications():
    """列出本人通知設定（總覽）。

    每筆附帶站名、到站時間、該站一週「有收運的星期」collect_days、
    以及逐日通知開關 notify_days{0..6}。
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    n.noti_id, n.station_id, n.remind_before_mins, n.is_active, n.push_method,
                    n.{', n.'.join(DAY_COLS)},
                    s.station_name, s.arrive_time
                FROM notifications n
                JOIN stations s ON n.station_id = s.station_id
                WHERE n.user_id = %s
                ORDER BY n.noti_id DESC
                """,
                (g.current_user['user_id'],)
            )
            rows = cursor.fetchall()

            data = []
            for row in rows:
                # 該站一週有收運的星期（任一類別有收即算），給前端列出可設定的天
                cursor.execute(
                    """
                    SELECT day_of_week
                    FROM station_schedules
                    WHERE station_id = %s
                      AND (collects_garbage = 1 OR collects_recycling = 1 OR collects_foodscraps = 1)
                    ORDER BY day_of_week
                    """,
                    (row['station_id'],)
                )
                collect_days = [r['day_of_week'] for r in cursor.fetchall()]

                data.append({
                    'noti_id': row['noti_id'],
                    'station_id': row['station_id'],
                    'station_name': row['station_name'],
                    'arrive_time': str(row['arrive_time']) if row['arrive_time'] is not None else None,
                    'remind_before_mins': row['remind_before_mins'],
                    'is_active': row['is_active'],
                    'push_method': row['push_method'],
                    'notify_days': {str(d): row[f'notify_d{d}'] for d in range(7)},
                    'collect_days': collect_days,
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/', methods=['POST'])
@line_required
def add_notification():
    """新增通知設定。body: { station_id*, remind_before_mins? }

    7 天通知開關預設全開（DB default 1）；沒收運的星期即使開著也不會推播。
    """
    data = request.get_json(silent=True) or {}
    station_id = data.get('station_id')
    if not station_id:
        return err('缺少 station_id', 400)
    remind_before_mins = data.get('remind_before_mins', 10)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO notifications (user_id, station_id, remind_before_mins, is_active, push_method)
                VALUES (%s, %s, %s, 1, 'line')
                """,
                (g.current_user['user_id'], station_id, remind_before_mins)
            )
            conn.commit()
            return ok({'noti_id': cursor.lastrowid}, status_code=201)

    except Exception as e:
        conn.rollback()
        if 'Duplicate entry' in str(e) or '1062' in str(e):
            return err('已對此站點設定過通知', 409)
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/<int:noti_id>', methods=['PATCH'])
@line_required
def update_notification(noti_id):
    """更新通知設定。可更新 remind_before_mins / is_active / push_method / notify_d0~d6。"""
    data = request.get_json(silent=True) or {}

    allowed_fields = ['remind_before_mins', 'is_active', 'push_method'] + DAY_COLS

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
                "DELETE FROM notifications WHERE noti_id = %s AND user_id = %s",
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
