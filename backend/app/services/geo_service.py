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
        with conn.cursor(dictionary=True) as cursor:
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
        JOIN routes r USING (route_id)
        JOIN areas a USING (areas_id)
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
        with conn.cursor(dictionary=True) as cursor:
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

def next_arrival(station_id):
    conn = get_db_connection()
    time_sql = "SELECT arrive_time FROM stations WHERE station_id = %s"
    schedule_sql = """
        SELECT day_of_week, collects_garbage, collects_recycling, collects_foodscraps 
        FROM station_schedules 
        WHERE station_id = %s
    """
    
    try:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(time_sql, (station_id,))
            station = cursor.fetchone()
            if not station:
                return None
                
            cursor.execute(schedule_sql, (station_id,))
            schedules = cursor.fetchall()
    finally:
        conn.close()
        
    if not schedules:
        return None

    sched_dict = {s['day_of_week']: s for s in schedules}
    now = datetime.datetime.now()
    
    # 轉換 weekday：Python 週一=0...週日=6 -> 系統 週日=0, 週一=1...週六=6
    current_sys_day = (now.weekday() + 1) % 7
    
    arrive_time_str = _format_time(station['arrive_time'])
    arrive_time_obj = datetime.datetime.strptime(arrive_time_str, "%H:%M:%S").time()

    for day_offset in range(8):
        check_day = (current_sys_day + day_offset) % 7
        
        if check_day in sched_dict:
            sched = sched_dict[check_day]
            has_service = sched['collects_garbage'] or sched['collects_recycling'] or sched['collects_foodscraps']
            
            if has_service:
                check_date = now.date() + datetime.timedelta(days=day_offset)
                arrival_datetime = datetime.datetime.combine(check_date, arrive_time_obj)
                
                # 如果是今天(offset=0)且車子開走，必須等下個星期的今天
                if day_offset == 0 and arrival_datetime <= now:
                    continue
                    
                in_minutes = int((arrival_datetime - now).total_seconds() // 60)
                
                types = []
                if sched['collects_garbage']: types.append("garbage")
                if sched['collects_recycling']: types.append("recycling")
                if sched['collects_foodscraps']: types.append("food")
                
                return {
                    "day_of_week": check_day,
                    "arrive_time": arrive_time_str,
                    "types": types,
                    "in_minutes": in_minutes
                }
                
    return None

def list_route_stations(route_id):
    conn = get_db_connection()
    sql = """
        SELECT station_id, station_name, latitude, longitude, sequence_order, arrive_time
        FROM stations
        WHERE route_id = %s
        ORDER BY sequence_order ASC
    """
    try:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(sql, (route_id,))
            results = cursor.fetchall()
    finally:
        conn.close()
        
    for r in results:
        r['latitude'] = float(r['latitude'])
        r['longitude'] = float(r['longitude'])
        r['arrive_time'] = _format_time(r['arrive_time'])
        
    return results
