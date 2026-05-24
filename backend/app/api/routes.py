"""站點與地理查詢 API（負責人：P1）

實作邏輯請寫在 app/services/geo_service.py，本層只負責收參數、呼叫 service、回傳 JSON。
回應一律用 app.utils.responses 的 ok() / err()。
"""
from flask import Blueprint, request
from app.utils.responses import ok, err
# from app.services import geo_service   # P1 實作後啟用

bp = Blueprint('stations', __name__, url_prefix='/api/stations')


@bp.route('/search', methods=['GET'])
def search_nearby():
    """附近站點搜尋。
    query: lat*, lng*, radius(km, 預設 2), limit(預設 20)
    回傳 data: [{ station_id, station_name, latitude, longitude, arrive_time, distance_km }]（依距離排序）
    """
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', type=float, default=2.0)
    limit = request.args.get('limit', type=int, default=20)
    if lat is None or lng is None:
        return err('缺少 lat 或 lng', 400)
    # TODO(P1): results = geo_service.find_nearby_stations(lat, lng, radius, limit)
    results = []
    return ok(results, count=len(results))


@bp.route('/<int:station_id>', methods=['GET'])
def station_detail(station_id):
    """站點明細 + 所屬路線/行政區 + 7 天收運日程。
    回傳 data: { station_id, station_name, latitude, longitude, arrive_time, leave_time,
                 route:{...}, area:{city,district,village}, schedules:[7] }
    """
    # TODO(P1): data = geo_service.get_station_detail(station_id) ; 找不到回 err(..., 404)
    return ok(None)


@bp.route('/<int:station_id>/next', methods=['GET'])
def station_next(station_id):
    """最快何時有車。
    回傳 data: { day_of_week, arrive_time, types:["garbage"/"recycling"/"food"], in_minutes }
    """
    # TODO(P1): data = geo_service.next_arrival(station_id)
    return ok(None)


@bp.route('/by-route/<int:route_id>', methods=['GET'])
def stations_by_route(route_id):
    """某路線的所有站點（依 sequence_order 排序），供地圖畫 polyline。
    回傳 data: [{ station_id, station_name, latitude, longitude, sequence_order, arrive_time }]
    """
    # TODO(P1): results = geo_service.list_route_stations(route_id)
    results = []
    return ok(results, count=len(results))
