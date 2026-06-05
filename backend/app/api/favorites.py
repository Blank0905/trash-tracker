"""常用清運定點（收藏）API（負責人：P2）

⚠️ 舊設計：me 頁已改用 /api/me/stations 整併 API（收藏＋通知合一），不再使用本檔。
   保留以待清理（背景推播與其他頁若仍依賴 favorites 表，資料表本身不受影響）。

皆需 X-Line-User-Id（line_required）；操作對象限本人（用 g.current_user['user_id']）。
資料表：favorites（unique(user_id, station_id)）。
"""
from flask import Blueprint, request, g
from app.utils.responses import ok, err
from app.utils.auth import line_required
from app.db import get_db_connection

bp = Blueprint('favorites', __name__, url_prefix='/api/favorites')


@bp.route('/', methods=['GET'])
@line_required
def list_favorites():
    """列出本人收藏。
    data: [{ fav_id, station_id, alias, station_name, latitude, longitude, arrive_time }]
    """
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    f.fav_id,
                    f.station_id,
                    f.alias,
                    s.station_name,
                    s.latitude,
                    s.longitude,
                    s.arrive_time
                FROM favorites f
                JOIN stations s ON f.station_id = s.station_id
                WHERE f.user_id = %s
                """,
                (g.current_user['user_id'],)
            )

            rows = cursor.fetchall()
            data = []

            for row in rows:
                # 連線池為 PyMySQL DictCursor，fetchall() 回傳的是 dict，須用欄位名取值
                data.append({
                    'fav_id': row['fav_id'],
                    'station_id': row['station_id'],
                    'alias': row['alias'],
                    'station_name': row['station_name'],
                    'latitude': float(row['latitude']) if row['latitude'] is not None else None,
                    'longitude': float(row['longitude']) if row['longitude'] is not None else None,
                    'arrive_time': str(row['arrive_time']) if row['arrive_time'] is not None else None
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/', methods=['POST'])
@line_required
def add_favorite():
    """新增收藏。body: { station_id*, alias? }"""
    data = request.get_json(silent=True) or {}
    station_id = data.get('station_id')
    if not station_id:
        return err('缺少 station_id', 400)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO favorites (user_id, station_id, alias)
                VALUES (%s, %s, %s)
                """,
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


@bp.route('/<int:fav_id>', methods=['PATCH'])
@line_required
def update_favorite(fav_id):
    """更新別名。body: { alias }"""
    data = request.get_json(silent=True) or {}
    if 'alias' not in data:
        return err('Missing alias', 400)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE favorites SET alias=%s WHERE fav_id=%s AND user_id=%s",
                (data.get('alias'), fav_id, g.current_user['user_id'])
            )
            conn.commit()
            if cursor.rowcount == 0:
                return err('Favorite not found', 404)
    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        conn.close()

    return ok(None)


@bp.route('/<int:fav_id>', methods=['DELETE'])
@line_required
def delete_favorite(fav_id):
    """刪除收藏。"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM favorites
                WHERE fav_id = %s AND user_id = %s
                """,
                (fav_id, g.current_user['user_id'])
            )
            conn.commit()

            if cursor.rowcount == 0:
                return err('Favorite not found', 404)
            return ok(None) 

    except Exception as e:
        conn.rollback()
        return err(str(e), 500)

    finally:
        conn.close()
