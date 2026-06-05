"""我的收藏站（收藏 + 通知整併）API（負責人：P5）

me 頁專用：以「收藏」為主軸，每個收藏站附帶該站收運日與通知狀態，
讓使用者直接在站點卡片上開關通知、逐日勾選要提醒的星期。

整併自舊的 favorites / notifications API（兩者已標為舊設計，保留待清理）。
皆需 X-Line-User-Id（line_required）；操作對象限本人（g.current_user['user_id']）。
資料表：favorites、notifications、station_schedules（皆沿用，不變動結構）。
"""
from flask import Blueprint, request, g
from app.utils.responses import ok, err
from app.utils.auth import line_required
from app.db import get_db_connection

bp = Blueprint('me', __name__, url_prefix='/api/me')

# 7 天通知開關欄位，對齊資料庫 day_of_week（0=日…6=六）
DAY_COLS = [f'notify_d{d}' for d in range(7)]


def _query_collect_days(cursor, station_id):
    """該站一週有收運的星期（任一類別有收即算），回傳已排序的 day_of_week 清單。"""
    cursor.execute(
        """
        SELECT day_of_week
        FROM station_schedules
        WHERE station_id = %s
          AND (collects_garbage = 1 OR collects_recycling = 1 OR collects_foodscraps = 1)
        ORDER BY day_of_week
        """,
        (station_id,)
    )
    return [r['day_of_week'] for r in cursor.fetchall()]


@bp.route('/stations', methods=['GET'])
@line_required
def list_my_stations():
    """列出本人收藏站，每站附帶 collect_days 與通知狀態。

    notify 為 null 表示該站尚未設定通知；前端據 collect_days 決定畫出哪幾天的勾選格。
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    f.fav_id, f.station_id, f.alias,
                    s.station_name, s.latitude, s.longitude, s.arrive_time,
                    n.noti_id, n.is_active, n.remind_before_mins, n.{', n.'.join(DAY_COLS)}
                FROM favorites f
                JOIN stations s ON f.station_id = s.station_id
                LEFT JOIN notifications n
                    ON n.station_id = f.station_id AND n.user_id = f.user_id
                WHERE f.user_id = %s
                ORDER BY f.fav_id DESC
                """,
                (g.current_user['user_id'],)
            )
            rows = cursor.fetchall()

            data = []
            for row in rows:
                collect_days = _query_collect_days(cursor, row['station_id'])

                # 沒有 notification row 時，LEFT JOIN 的 noti_id 為 NULL
                notify = None
                if row['noti_id'] is not None:
                    notify = {
                        'noti_id': row['noti_id'],
                        'is_active': row['is_active'],
                        'remind_before_mins': row['remind_before_mins'],
                        'notify_days': {str(d): row[f'notify_d{d}'] for d in range(7)},
                    }

                data.append({
                    'fav_id': row['fav_id'],
                    'station_id': row['station_id'],
                    'alias': row['alias'],
                    'station_name': row['station_name'],
                    'latitude': float(row['latitude']) if row['latitude'] is not None else None,
                    'longitude': float(row['longitude']) if row['longitude'] is not None else None,
                    'arrive_time': str(row['arrive_time']) if row['arrive_time'] is not None else None,
                    'collect_days': collect_days,
                    'notify': notify,
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/stations', methods=['POST'])
@line_required
def add_my_station():
    """新增收藏。body: { station_id*, alias? }"""
    data = request.get_json(silent=True) or {}
    station_id = data.get('station_id')
    if not station_id:
        return err('缺少 station_id', 400)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO favorites (user_id, station_id, alias) VALUES (%s, %s, %s)",
                (g.current_user['user_id'], station_id, data.get('alias'))
            )
            conn.commit()
            return ok({'fav_id': cursor.lastrowid}, status_code=201)

    except Exception as e:
        conn.rollback()
        if 'Duplicate entry' in str(e) or '1062' in str(e):
            return err('已收藏過此站點', 409)
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/stations/<int:station_id>', methods=['DELETE'])
@line_required
def delete_my_station(station_id):
    """取消收藏；同一交易內連帶刪除該站的通知設定。"""
    user_id = g.current_user['user_id']
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 通知依附在收藏上：先刪通知、再刪收藏，最後一起 commit
            cursor.execute(
                "DELETE FROM notifications WHERE user_id = %s AND station_id = %s",
                (user_id, station_id)
            )
            cursor.execute(
                "DELETE FROM favorites WHERE user_id = %s AND station_id = %s",
                (user_id, station_id)
            )
            # rowcount 取最後一句（刪收藏）；為 0 表示本來就沒收藏這站
            if cursor.rowcount == 0:
                conn.rollback()
                return err('找不到收藏', 404)

            conn.commit()
            return ok(None)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/stations/<int:station_id>', methods=['PATCH'])
@line_required
def rename_my_station(station_id):
    """更新收藏別名。body: { alias }（傳空字串即清除別名，顯示時退回站名）。"""
    data = request.get_json(silent=True) or {}
    if 'alias' not in data:
        return err('缺少 alias', 400)

    user_id = g.current_user['user_id']
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 先確認該站為本人收藏（避免別名值未變時 UPDATE rowcount=0 被誤判 404）
            cursor.execute(
                "SELECT 1 FROM favorites WHERE user_id = %s AND station_id = %s",
                (user_id, station_id)
            )
            if not cursor.fetchone():
                return err('找不到收藏', 404)

            cursor.execute(
                "UPDATE favorites SET alias = %s WHERE user_id = %s AND station_id = %s",
                (data.get('alias'), user_id, station_id)
            )
            conn.commit()
            return ok(None)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/stations/<int:station_id>/notify', methods=['PATCH'])
@line_required
def set_my_notify(station_id):
    """開關 / 更新某收藏站的通知。body: { is_active?, remind_before_mins?, notify_days? }

    notify_days 形如 {"4": 0, "6": 1}（key=星期 0-6，value 視為布林）。
    remind_before_mins 須為 1-60 的整數。
    - 該站尚無通知設定時：建立一筆，逐日預設依「該站有收運的星期」（有收=1、沒收=0），
      再套用 body.notify_days 覆蓋；is_active 預設 1、remind_before_mins 預設 5。
    - 已有設定時：只更新有提供的欄位（is_active、remind_before_mins、notify_days 內指定的星期）。
    """
    user_id = g.current_user['user_id']
    body = request.get_json(silent=True) or {}

    # 解析並驗證 notify_days：key 須為 0-6 的整數，value 轉成 0/1
    try:
        day_overrides = {int(k): (1 if int(v) else 0) for k, v in (body.get('notify_days') or {}).items()}
    except (ValueError, TypeError):
        return err('notify_days 格式錯誤', 400)
    if any(d < 0 or d > 6 for d in day_overrides):
        return err('星期需為 0-6', 400)

    # 解析並驗證 remind_before_mins：1-60 的整數
    mins = None
    if 'remind_before_mins' in body:
        try:
            mins = int(body['remind_before_mins'])
        except (ValueError, TypeError):
            return err('remind_before_mins 需為整數', 400)
        if not 1 <= mins <= 60:
            return err('remind_before_mins 需介於 1-60', 400)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 通知只能掛在本人收藏的站上
            cursor.execute(
                "SELECT 1 FROM favorites WHERE user_id = %s AND station_id = %s",
                (user_id, station_id)
            )
            if not cursor.fetchone():
                return err('此站不在收藏中', 404)

            cursor.execute(
                "SELECT noti_id FROM notifications WHERE user_id = %s AND station_id = %s",
                (user_id, station_id)
            )
            existing = cursor.fetchone()

            if existing is None:
                # 建立：逐日預設依該站收運日（有收=1、沒收=0），再套用 body 覆蓋
                collect_days = _query_collect_days(cursor, station_id)
                day_values = [1 if d in collect_days else 0 for d in range(7)]
                for d, v in day_overrides.items():
                    day_values[d] = v
                is_active = 1 if body.get('is_active', 1) else 0
                remind = mins if mins is not None else 5

                cursor.execute(
                    f"""
                    INSERT INTO notifications
                        (user_id, station_id, remind_before_mins, is_active, push_method, {', '.join(DAY_COLS)})
                    VALUES (%s, %s, %s, %s, 'line', {', '.join(['%s'] * 7)})
                    """,
                    (user_id, station_id, remind, is_active, *day_values)
                )
                conn.commit()
                return ok({'noti_id': cursor.lastrowid}, status_code=201)

            # 更新：只動有提供的欄位
            set_clauses = []
            values = []
            if 'is_active' in body:
                set_clauses.append('is_active = %s')
                values.append(1 if body['is_active'] else 0)
            if mins is not None:
                set_clauses.append('remind_before_mins = %s')
                values.append(mins)
            for d, v in day_overrides.items():
                set_clauses.append(f'notify_d{d} = %s')
                values.append(v)

            if not set_clauses:
                return err('沒有提供可更新的欄位', 400)

            values.extend([user_id, station_id])
            cursor.execute(
                f"UPDATE notifications SET {', '.join(set_clauses)} WHERE user_id = %s AND station_id = %s",
                values
            )
            conn.commit()
            return ok(None)

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()
