"""常用清運定點（收藏）API（負責人：P2）

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
    # TODO(P2): SELECT f.*, s.station_name, s.latitude, s.longitude, s.arrive_time
    #           FROM favorites f JOIN stations s USING(station_id)
    #           WHERE f.user_id = g.current_user['user_id']
    return ok([], count=0)


@bp.route('/', methods=['POST'])
@line_required
def add_favorite():
    """新增收藏。body: { station_id*, alias? }"""
    data = request.get_json(silent=True) or {}
    station_id = data.get('station_id')
    if not station_id:
        return err('缺少 station_id', 400)
    # TODO(P2): INSERT INTO favorites (user_id, station_id, alias) ...
    #           已收藏（unique 衝突）回 err('已收藏過此站點', 409)
    return ok({'fav_id': None}, status_code=201)


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
    # TODO(P2): DELETE FROM favorites WHERE fav_id=%s AND user_id=%s
    return ok(None)
