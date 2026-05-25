from app.db import get_db_connection

def get_station_detail(station_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    station_sql = """
        SELECT s.station_id, s.station_name, s.latitude, s.longitude, s.arrive_time, s.leave_time,
               r.route_id, r.route_name, r.route_code,
               a.city, a.district, a.village
        FROM stations s
        JOIN routes r USING (route_id)
        JOIN areas a USING (areas_id)
        WHERE s.station_id = %s
    """
    
    try:
        cursor.execute(station_sql, (station_id,))
        station_data = cursor.fetchone()
        if not station_data:
            return None
        schedule_sql = """
            SELECT day_of_week, collects_garbage, collects_recycling, collects_foodscraps 
            FROM station_schedules 
            WHERE station_id = %s
            ORDER BY day_of_week ASC
        """
        cursor.execute(schedule_sql, (station_id,))
        schedules = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    formatted_result = {
        "station_id": station_data["station_id"],
        "station_name": station_data["station_name"],
        "latitude": float(station_data["latitude"]),
        "longitude": float(station_data["longitude"]),
        "arrive_time": str(station_data["arrive_time"]),
        "leave_time": str(station_data["leave_time"]),
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
        "schedules": schedules 
    }
    
    return formatted_result
