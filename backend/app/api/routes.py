from flask import Blueprint

bp = Blueprint('stations', __name__, url_prefix='/api/stations')

# 站點相關端點待實作：
#   - 鄰近站點搜尋（呼叫 geo_service，含 Bounding Box + Haversine）
#   - 站點明細 / 收運日程查詢
# 邏輯請寫在 app/services/geo_service.py，本層僅負責接收請求與回傳 JSON。
