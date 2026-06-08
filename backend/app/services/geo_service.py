import math
import datetime
from app.db import get_db_connection


def _format_time(t):
    if isinstance(t, datetime.timedelta):
        total_seconds = int(t.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    elif isinstance(t, (datetime.time, datetime.datetime)):
        return t.strftime("%H:%M:%S")
    return str(t) if t else "00:00:00"
# BBox 先過濾2公里內再Haversine 計算
def find_nearby_stations(lat, lng, radius_km=2.0, limit=20):
    conn = get_db_connection()

    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
    
    lat_min, lat_max = lat - lat_delta, lat + lat_delta
    lng_min, lng_max = lng - lng_delta, lng + lng_delta
    sql = """
        SELECT station_id, station_name, latitude, longitude, arrive_time,
               (6371 * acos(
                    cos(radians(%s)) * cos(radians(latitude)) * cos(radians(longitude) - radians(%s))
                    + sin(radians(%s)) * sin(radians(latitude))
               )) AS distance_km
        FROM stations
        WHERE latitude BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
        HAVING distance_km <= %s
        ORDER BY distance_km ASC
        LIMIT %s
    """
    
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, (lat, lng, lat, lat_min, lat_max, lng_min, lng_max, radius_km, limit))
            results = cursor.fetchall()
    finally:
        conn.close()
        
    for r in results:
        r['latitude'] = float(r['latitude'])
        r['longitude'] = float(r['longitude'])
        r['arrive_time'] = _format_time(r['arrive_time'])
        r['distance_km'] = round(float(r['distance_km']), 2)
    return results

def get_station_detail(station_id):
    conn = get_db_connection()
    
    station_sql = """
        SELECT s.station_id, s.station_name, s.latitude, s.longitude, s.arrive_time, s.leave_time,
               r.route_id, r.route_name, r.route_code,
               a.city, a.district, a.village
        FROM stations s
        JOIN routes r ON r.route_id = s.route_id
        JOIN areas a ON a.areas_id = s.areas_id
        WHERE s.station_id = %s
    """
    #日=0, 一=1..
    schedule_sql = """
        SELECT day_of_week, collects_garbage, collects_recycling, collects_foodscraps 
        FROM station_schedules 
        WHERE station_id = %s
        ORDER BY day_of_week ASC
    """
    
    try:
        with conn.cursor() as cursor:
            cursor.execute(station_sql, (station_id,))
            station_data = cursor.fetchone()
            
            if not station_data:
                return None
                
            cursor.execute(schedule_sql, (station_id,))
            schedules = cursor.fetchall()
    finally:
        conn.close()

    formatted_result = {
        "station_id": station_data["station_id"],
        "station_name": station_data["station_name"],
        "latitude": float(station_data["latitude"]),
        "longitude": float(station_data["longitude"]),
        "arrive_time": _format_time(station_data["arrive_time"]),
        "leave_time": _format_time(station_data["leave_time"]),
        "route": {
            "route_id": station_data["route_id"],
            "route_name": station_data["route_name"],
            "route_code": station_data["route_code"]
        },
        "area": {
            "city": station_data["city"],
            "district": station_data["district"],
            "village": station_data["village"]
        },
        "schedules": [
            {
                "day_of_week": int(s["day_of_week"]),
                "collects_garbage": int(s["collects_garbage"]),
                "collects_recycling": int(s["collects_recycling"]),
                "collects_foodscraps": int(s["collects_foodscraps"])
            }
            for s in schedules
        ]
    }
    
    return formatted_result

def list_route_stations(route_id):
    conn = get_db_connection()
    sql = """
        SELECT station_id, station_name, latitude, longitude, sequence_order, arrive_time
        FROM stations
        WHERE route_id = %s
        ORDER BY (sequence_order IS NULL), sequence_order ASC, arrive_time ASC
    """
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, (route_id,))
            results = cursor.fetchall()
    finally:
        conn.close()
        
    for r in results:
        r['latitude'] = float(r['latitude'])
        r['longitude'] = float(r['longitude'])
        r['arrive_time'] = _format_time(r['arrive_time'])
        
    return results
