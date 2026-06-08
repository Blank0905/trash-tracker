"""站點與地理查詢 API（負責人：P1）

實作邏輯請寫在 app/services/geo_service.py，本層只負責收參數、呼叫 service、回傳 JSON。
回應一律用 app.utils.responses 的 ok() / err()。
"""
from flask import Blueprint, request
from app.services import geo_service
from app.utils.responses import ok, err

bp = Blueprint('stations', __name__, url_prefix='/api/stations')

@bp.route('/search', methods=['GET'])
def search_nearby():

    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', type=float, default=2.0)
    limit = request.args.get('limit', type=int, default=20)

    if lat is None or lng is None:
        return err('缺少必要參數 lat 或 lng', 400)

    # 限制最大撈取數量
    if limit > 200:
        limit = 200

    stations = geo_service.find_nearby_stations(lat, lng, radius, limit)
    return ok(stations, count=len(stations))

@bp.route('/<int:station_id>', methods=['GET'])
def get_station_detail_endpoint(station_id):
    result = geo_service.get_station_detail(station_id)
    if not result:
        return err('找不到該站點資訊', 404)
    return ok(result)

@bp.route('/by-route/<int:route_id>', methods=['GET'])
def get_stations_by_route(route_id):
    stations = geo_service.list_route_stations(route_id)
    return ok(stations, count=len(stations))
