"""資訊查詢 API（公開，不需身分）（負責人：P2）

垃圾袋規範 / 大型廢棄物清運資訊 / 環保政策公告。
資料表：bag_regulations、bulky_waste_info、announcements。
"""
from flask import Blueprint, request
from app.utils.responses import ok
# from app.db import get_db_connection

bp = Blueprint('info', __name__, url_prefix='/api/info')


@bp.route('/bag-regulations', methods=['GET'])
def bag_regulations():
    """垃圾袋規範。query: city?（不帶則回全部）
    data: [{ reg_id, city, bag_size, volume_liters, price, purchase_locations, notes }]
    """
    city = request.args.get('city')
    # TODO(P2): SELECT * FROM bag_regulations [WHERE city=%s]
    return ok([], count=0)


@bp.route('/bulky-waste', methods=['GET'])
def bulky_waste():
    """大型廢棄物清運資訊。query: city?
    data: [{ info_id, city, title, content, updated_at }]
    """
    city = request.args.get('city')
    # TODO(P2): SELECT * FROM bulky_waste_info [WHERE city=%s]
    return ok([], count=0)


@bp.route('/announcements', methods=['GET'])
def announcements():
    """環保政策公告（給使用者看）。query: city?
    回傳 target_city 為 NULL（全體）或符合 city 者，新到舊排序。
    data: [{ announcement_id, title, content, target_city, created_at }]
    """
    city = request.args.get('city')
    # TODO(P2): SELECT ... FROM announcements
    #           WHERE target_city IS NULL [OR target_city=%s] ORDER BY created_at DESC
    return ok([], count=0)
