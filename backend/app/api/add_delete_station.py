from flask import Blueprint, request, jsonify
from app.db import get_db_connection
from app.utils.auth import admin_required
from app.utils.audit import write_audit_log
import pymysql
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# 🟢 獨立的後台站點管理藍圖，前綴採用 /api/admin/stations
bp = Blueprint('add_delete_station', __name__, url_prefix='/api/admin/stations')


GEOCODE_USER_AGENT = 'greater-taipei-trash-tracker/1.0'


def _safe_geocode_text(value):
    if value is None:
        return ''
    return str(value).strip()


def _proxy_nominatim_search(query):
    query_string = urlencode({
        'q': query,
        'format': 'jsonv2',
        'limit': 5,
        'countrycodes': 'tw',
        'addressdetails': 1,
    })
    request = Request(
        f'https://nominatim.openstreetmap.org/search?{query_string}',
        headers={
            'User-Agent': GEOCODE_USER_AGENT,
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        }
    )
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode('utf-8'))


def _time_key(value):
    """把 HH:MM 轉成可比較的分鐘數；無效值回傳 None。"""
    if not value:
        return None
    try:
        hour_str, minute_str = str(value).split(':')
        return int(hour_str) * 60 + int(minute_str)
    except (ValueError, TypeError):
        return None


def _find_station_by_sequence(stations, sequence_order):
    """從站點清單中找出指定序位的站點。"""
    target_seq = int(sequence_order)
    for station in stations:
        try:
            if int(station.get('sequence_order')) == target_seq:
                return station
        except (TypeError, ValueError):
            continue
    return None


def _validate_sequence_and_times(cursor, route_id, sequence_order, arrive_time, leave_time):
    """檢查序位是否連續、抵達是否晚於前站、駛離是否早於後站。"""
    cursor.execute(
        """
            SELECT sequence_order,
                   TIME_FORMAT(arrive_time, '%%H:%%i') as arrive_time,
                   TIME_FORMAT(leave_time, '%%H:%%i') as leave_time
            FROM stations
            WHERE route_id = %s
        """,
        [route_id]
    )
    siblings = cursor.fetchall()

    sequence_order = int(sequence_order)
    prev_station = _find_station_by_sequence(siblings, sequence_order - 1)
    next_station = _find_station_by_sequence(siblings, sequence_order + 1)

    if sequence_order > 1 and not prev_station:
        return {"ok": False, "message": f"排序不連續！請先建立序位較前的站點（目前缺少序位: {sequence_order - 1}）"}

    prev_leave_key = _time_key(prev_station.get('leave_time')) if prev_station else None
    arrive_key = _time_key(arrive_time)
    if prev_station and prev_leave_key is not None and arrive_key is not None and arrive_key <= prev_leave_key:
        return {
            "ok": False,
            "message": f"時間衝突！當前抵達時間({arrive_time})必須晚於前一站的駛離時間({prev_station['leave_time']})"
        }

    next_arrive_key = _time_key(next_station.get('arrive_time')) if next_station else None
    leave_key = _time_key(leave_time)
    if next_station and next_arrive_key is not None and leave_key is not None and leave_key >= next_arrive_key:
        return {
            "ok": False,
            "message": f"時間衝突！當前駛離時間({leave_time})必須早於下一站的抵達時間({next_station['arrive_time']})"
        }

    return {"ok": True}


# ==========================================
# 1. 📋 [後台專用] 讀取目前現存站點一覽 (支援選填動態篩選)
# ==========================================
@bp.route('/list', methods=['GET'])
@admin_required
def get_stations_list():
    """撈取站點，並 INNER JOIN 帶出路線與區域細節，支援 route_id, route_name, city, district, station_name 篩選"""
    route_id = request.args.get('route_id')
    route_name = request.args.get('route_name')
    city = request.args.get('city')
    district = request.args.get('district')
    station_name = request.args.get('station_name')
    latest = request.args.get('latest')
    limit = request.args.get('limit', '50')

    has_filter = (
        (route_id and route_id.strip() != '') or
        (route_name and route_name.strip() != '') or
        (city and city != '全部') or
        (district and district.strip() != '') or
        (station_name and station_name.strip() != '')
    )
    latest_mode = latest == '1' or not has_filter

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 💡 使用 TIME_FORMAT 格式化時間為 HH:i，能完美防範 Python timedelta 造成的 JSON 序列化閃退！
            sql = """
                SELECT s.station_id, s.route_id, s.areas_id, s.station_name, 
                       s.sequence_order, s.longitude, s.latitude,
                       TIME_FORMAT(s.arrive_time, '%%H:%%i') as arrive_time, 
                       TIME_FORMAT(s.leave_time, '%%H:%%i') as leave_time,
                       s.stay_type, s.memo,
                       r.route_name, r.trip_number,
                       a.city, a.district, a.village
                FROM stations s
                INNER JOIN routes r ON s.route_id = r.route_id
                INNER JOIN areas a ON s.areas_id = a.areas_id
                WHERE 1=1
            """
            params = []

            if route_id and route_id.strip() != '':
                sql += " AND s.route_id = %s"
                params.append(int(route_id))

            if route_name and route_name.strip() != '':
                sql += " AND r.route_name LIKE %s"
                params.append(f"%{route_name}%")

            if city and city != '全部':
                sql += " AND a.city = %s"
                params.append(city)

            if district and district.strip() != '':
                sql += " AND a.district = %s"
                params.append(district)

            if station_name and station_name.strip() != '':
                sql += " AND s.station_name LIKE %s"
                params.append(f"%{station_name}%")

            if latest_mode:
                sql += " ORDER BY s.station_id DESC"
                try:
                    limit_value = max(1, min(50, int(limit)))
                except (TypeError, ValueError):
                    limit_value = 50
                sql += " LIMIT %s"
                params.append(limit_value)
            else:
                # 依路線與序位排序，讓管理員看清單時邏輯最順
                sql += " ORDER BY s.route_id ASC, s.sequence_order ASC, s.station_id DESC"

            cursor.execute(sql, params)
            stations = cursor.fetchall()

        return jsonify({"status": "success", "stations": stations}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"後台站點篩選失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/geocode', methods=['GET'])
def geocode_station_address():
    """後端代理 OSM Nominatim，避免瀏覽器端 CORS 並統一回傳格式。"""
    query = _safe_geocode_text(request.args.get('q'))

    if not query:
        return jsonify({"status": "error", "message": "缺少地址查詢參數 q！"}), 400

    try:
        results = _proxy_nominatim_search(query)
        simplified_results = []

        for item in results:
            try:
                simplified_results.append({
                    "display_name": item.get('display_name'),
                    "lat": float(item.get('lat')),
                    "lon": float(item.get('lon')),
                })
            except (TypeError, ValueError):
                continue

        return jsonify({"status": "success", "data": simplified_results}), 200
    except (URLError, HTTPError, TimeoutError, json.JSONDecodeError) as e:
        return jsonify({"status": "error", "message": f"地圖定位服務暫時無法使用: {str(e)}"}), 502


# ==========================================
# 2. 🚀 [後台專用] 新增站點 ＆ 一鍵每週 7 日班次 (Transaction 級聯寫入)
# ==========================================
@bp.route('/create', methods=['POST'])
@admin_required
def create_station_with_schedule():
    """接收前端的複合型 JSON，並落實三大資工級時序防禦線"""
    data = request.get_json(silent=True) or {}
    station_data = data.get('station_data', {})
    schedules_data = data.get('schedules_data', [])

    route_id = station_data.get('route_id')
    areas_id = station_data.get('areas_id')
    station_name = (station_data.get('station_name') or '').strip()
    arrive_time = (station_data.get('arrive_time') or '').strip()
    leave_time = (station_data.get('leave_time') or '').strip()
    stay_type = (station_data.get('stay_type') or '').strip()

    try:
        route_id = int(route_id)
        areas_id = int(areas_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "隸屬路線 ID 與區域 ID 必須是有效整數！"}), 400

    # 🛡️ 後端第一道防禦：核心必填檢查
    if route_id <= 0 or areas_id <= 0 or not station_name:
        return jsonify({"status": "error", "message": "隸屬路線 ID、區域 ID 與站點名稱為必填欄位！"}), 400

    if not isinstance(schedules_data, list) or len(schedules_data) != 7:
        return jsonify({"status": "error", "message": "每週班次日程必須完整提供 7 天資料！"}), 400

    day_indexes = [day.get('day_of_week') for day in schedules_data]
    if sorted(day_indexes) != list(range(7)):
        return jsonify({"status": "error", "message": "每週班次日程的 day_of_week 必須完整且為 0 到 6！"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 🟢 步驟 A：動態檢查該路線的縣市別，用來判定是否要啟用「順序與時間防禦」
            cursor.execute("SELECT a.city FROM routes r INNER JOIN areas a ON r.areas_id = a.areas_id WHERE r.route_id = %s", [route_id])
            route_info = cursor.fetchone()
            if not route_info:
                return jsonify({"status": "error", "message": "找不到該隸屬路線，請確認路線是否被刪除！"}), 404

            city = route_info['city']
            sequence_order = None

            if city == '台北市':
                # 台北市規格：強制為 NULL (免填)
                sequence_order = None
            else:
                # 新北與基隆規格：進行嚴格的連續性與時序防禦
                try:
                    sequence_order = int(station_data.get('sequence_order', 1))
                except (ValueError, TypeError):
                    return jsonify({"status": "error", "message": "新北與基隆路線之順序順位必須為有效整數！"}), 400

                if sequence_order < 1:
                    return jsonify({"status": "error", "message": "順序順位必須大於或等於 1！"}), 400

                if sequence_order == 1:
                    cursor.execute(
                        "SELECT 1 FROM stations WHERE route_id = %s AND sequence_order = 1 LIMIT 1",
                        [route_id]
                    )
                    if cursor.fetchone():
                        return jsonify({"status": "error", "message": "該路線已存在序位 1 的起始站點！"}), 400
                else:
                    validation = _validate_sequence_and_times(
                        cursor,
                        route_id,
                        sequence_order,
                        arrive_time,
                        leave_time
                    )
                    if not validation["ok"]:
                        return jsonify({"status": "error", "message": validation["message"]}), 400

            # 🛡️ 重複資料防禦：除了主鍵外，其他欄位完全相同就不允許新增
            duplicate_sql = """
                SELECT station_id
                FROM stations
                WHERE route_id = %s
                  AND areas_id = %s
                  AND station_name = %s
                  AND sequence_order <=> %s
                  AND longitude = %s
                  AND latitude = %s
                  AND arrive_time = %s
                  AND leave_time = %s
                  AND COALESCE(stay_type, '') = COALESCE(%s, '')
                  AND COALESCE(memo, '') = COALESCE(%s, '')
                LIMIT 1
            """
            cursor.execute(duplicate_sql, (
                int(route_id),
                int(areas_id),
                station_name,
                sequence_order,
                float(station_data.get('longitude', 121.0000000)),
                float(station_data.get('latitude', 25.0000000)),
                arrive_time,
                leave_time,
                stay_type if stay_type else None,
                station_data.get('memo')
            ))
            duplicate_station = cursor.fetchone()
            if duplicate_station:
                return jsonify({"status": "error", "message": "資料完全重複，已存在相同站點記錄，禁止重複新增！"}), 409

            # 🟢 步驟 B：正式寫入 stations 本體
            insert_station_sql = """
                INSERT INTO stations (route_id, areas_id, station_name, sequence_order, 
                                      longitude, latitude, arrive_time, leave_time, stay_type, memo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_station_sql, (
                int(route_id),
                int(areas_id),
                station_name,
                sequence_order,
                float(station_data.get('longitude', 121.0000000)),
                float(station_data.get('latitude', 25.0000000)),
                arrive_time,
                leave_time,
                stay_type if stay_type else None,
                station_data.get('memo')
            ))

            # 🟢 步驟 C：自動抓出剛Insert生成的主鍵 (station_id)
            new_station_id = cursor.lastrowid

            # 🟢 步驟 D：迴圈寫入 7 天份的每週班次日程子表
            insert_schedule_sql = """
                INSERT INTO station_schedules (station_id, day_of_week, collects_garbage, 
                                               collects_recycling, collects_foodscraps)
                VALUES (%s, %s, %s, %s, %s)
            """
            for day in schedules_data:
                cursor.execute(insert_schedule_sql, (
                    new_station_id,
                    int(day.get('day_of_week')),
                    int(day.get('collects_garbage', 0)),
                    int(day.get('collects_recycling', 0)),
                    int(day.get('collects_foodscraps', 0))
                ))

            # 一體化 Commit 提交！
            write_audit_log(
                'station_create',
                target_type='station',
                target_id=new_station_id,
                details={
                    'route_id': (locals().get('station_data') or {}).get('route_id'),
                    'station_name': (locals().get('station_data') or {}).get('station_name'),
                    'sequence_order': (locals().get('station_data') or {}).get('sequence_order'),
                    'target_city': (locals().get('station_data') or {}).get('city'),
                    'district': (locals().get('station_data') or {}).get('district'),
                    'arrive_time': (locals().get('station_data') or {}).get('arrive_time'),
                    'leave_time': (locals().get('station_data') or {}).get('leave_time'),
                },
                cursor=cursor,
            )

            conn.commit()

        return jsonify({"status": "success", "message": "全新清運點與 7 日班次排程已成功級聯綁定存檔！"}), 201

    except Exception as e:
        conn.rollback()  # 安全第一，有錯必回滾
        print(f"[create_station_with_schedule] {type(e).__name__}: {e}")
        return jsonify({"status": "error", "message": f"站點交易寫入大崩潰: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 3. ✏️ [後台專用] 編輯更新現存站點資料 (滿足限更欄位與夾攻防禦)
# ==========================================
@bp.route('/update/<int:station_id>', methods=['POST', 'PUT'])
@admin_required
def update_station(station_id):
    """只允許更改 station_name, arrive_time, leave_time，且新北基隆需過關時序夾攻防禦"""
    data = request.get_json(silent=True) or {}
    station_name = data.get('station_name')
    arrive_time = data.get('arrive_time')
    leave_time = data.get('leave_time')
    schedules_data = data.get('schedules_data')

    if not station_name or not arrive_time or not leave_time:
        return jsonify({"status": "error", "message": "站點名稱、抵達與駛離時間皆為編輯必填項！"}), 400

    if schedules_data is not None:
        if not isinstance(schedules_data, list) or len(schedules_data) != 7:
            return jsonify({"status": "error", "message": "每週班次日程更新必須完整提供 7 天資料！"}), 400

        day_indexes = [day.get('day_of_week') for day in schedules_data]
        if sorted(day_indexes) != list(range(7)):
            return jsonify({"status": "error", "message": "每週班次日程更新的 day_of_week 必須完整且為 0 到 6！"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 🟢 步驟 A：先撈出此站點本體的城市、路線與序位狀態
            info_sql = """
                SELECT s.route_id, s.sequence_order, a.city 
                FROM stations s 
                INNER JOIN areas a ON s.areas_id = a.areas_id 
                WHERE s.station_id = %s
            """
            cursor.execute(info_sql, [station_id])
            current_station = cursor.fetchone()

            if not current_station:
                return jsonify({"status": "error", "message": "找不到該待編輯站點資訊！"}), 404

            # 🟢 步驟 B：如果不是台北市，啟動前後夾攻防禦線（前後序位比對）
            if current_station['city'] != '台北市' and current_station['sequence_order']:
                seq = int(current_station['sequence_order'])
                rid = current_station['route_id']
                cursor.execute(
                    """
                        SELECT sequence_order,
                               TIME_FORMAT(arrive_time, '%%H:%%i') as arrive_time,
                               TIME_FORMAT(leave_time, '%%H:%%i') as leave_time
                        FROM stations
                        WHERE route_id = %s AND station_id != %s
                    """,
                    (rid, station_id)
                )
                siblings = cursor.fetchall()

                prev_st = _find_station_by_sequence(siblings, seq - 1)
                if prev_st:
                    prev_leave_key = _time_key(prev_st.get('leave_time'))
                    arrive_key = _time_key(arrive_time)
                    if prev_leave_key is not None and arrive_key is not None and arrive_key <= prev_leave_key:
                        return jsonify({"status": "error", "message": f"時間時序衝突！抵達時間必須晚於前一站({seq-1})的駛離時間 ({prev_st['leave_time']})"}), 400

                next_st = _find_station_by_sequence(siblings, seq + 1)
                if next_st:
                    next_arrive_key = _time_key(next_st.get('arrive_time'))
                    leave_key = _time_key(leave_time)
                    if next_arrive_key is not None and leave_key is not None and leave_key >= next_arrive_key:
                        return jsonify({"status": "error", "message": f"時間時序衝突！駛離時間必須早於下一站({seq+1})的抵達時間 ({next_st['arrive_time']})"}), 400

            # 🟢 步驟 C：嚴格限制只更新這三個欄位
            update_sql = """
                UPDATE stations 
                SET station_name = %s, arrive_time = %s, leave_time = %s 
                WHERE station_id = %s
            """
            cursor.execute(update_sql, (station_name, arrive_time, leave_time, station_id))

            if current_station['city'] != '台北市' and current_station['sequence_order']:
                seq = int(current_station['sequence_order'])
                rid = current_station['route_id']

                cursor.execute(
                    """
                        SELECT station_id, sequence_order,
                               TIME_FORMAT(arrive_time, '%%H:%%i') as arrive_time,
                               TIME_FORMAT(leave_time, '%%H:%%i') as leave_time
                        FROM stations
                        WHERE route_id = %s AND station_id != %s
                    """,
                    (rid, station_id)
                )
                siblings = cursor.fetchall()

                prev_st = _find_station_by_sequence(siblings, seq - 1)
                if prev_st:
                    prev_leave_key = _time_key(prev_st.get('leave_time'))
                    arrive_key = _time_key(arrive_time)
                    if prev_leave_key is not None and arrive_key is not None and arrive_key <= prev_leave_key:
                        return jsonify({"status": "error", "message": f"時間時序衝突！抵達時間必須晚於前一站({seq-1})的駛離時間 ({prev_st['leave_time']})"}), 400

                next_st = _find_station_by_sequence(siblings, seq + 1)
                if next_st:
                    next_arrive_key = _time_key(next_st.get('arrive_time'))
                    leave_key = _time_key(leave_time)
                    if next_arrive_key is not None and leave_key is not None and leave_key >= next_arrive_key:
                        return jsonify({"status": "error", "message": f"時間時序衝突！駛離時間必須早於下一站({seq+1})的抵達時間 ({next_st['arrive_time']})"}), 400

            # 🟢 步驟 D：同步更新每週班次日程
            if schedules_data is not None:
                cursor.execute("DELETE FROM station_schedules WHERE station_id = %s", [station_id])

                insert_schedule_sql = """
                    INSERT INTO station_schedules (
                        station_id, day_of_week, collects_garbage,
                        collects_recycling, collects_foodscraps
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """
                for day in schedules_data:
                    cursor.execute(insert_schedule_sql, (
                        station_id,
                        int(day.get('day_of_week')),
                        int(day.get('collects_garbage', 0)),
                        int(day.get('collects_recycling', 0)),
                        int(day.get('collects_foodscraps', 0))
                    ))

            conn.commit()

        return jsonify({"status": "success", "message": "該站點及其限制欄位已成功就地更新儲存！"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"站點行內修改失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 4. 🗑️ [後台專用] 刪除清運站點 (逆向連鎖級聯 Transaction)
# ==========================================
@bp.route('/delete/<int:station_id>', methods=['POST', 'DELETE'])
@admin_required
def delete_station(station_id):
    """逆向物理抹除線：先剁掉子表班次，再抹去站點本體，一氣呵成"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                "SELECT route_id, sequence_order FROM stations WHERE station_id = %s",
                [station_id]
            )
            target_station = cursor.fetchone()
            if not target_station:
                return jsonify({"status": "error", "message": "找不到該站點，無法刪除！"}), 404

            # A. 移除關聯的每週日程
            cursor.execute("DELETE FROM station_schedules WHERE station_id = %s", [station_id])
            # B. 移除站點本體
            cursor.execute("DELETE FROM stations WHERE station_id = %s", [station_id])

            deleted_seq = target_station.get('sequence_order')
            route_id = target_station.get('route_id')

            if deleted_seq is not None:
                deleted_seq = int(deleted_seq)
                cursor.execute(
                    """
                        UPDATE stations
                        SET sequence_order = sequence_order - 1
                        WHERE route_id = %s
                          AND sequence_order > %s
                    """,
                    [route_id, deleted_seq]
                )

            write_audit_log(
                'station_delete',
                target_type='station',
                target_id=station_id,
                details={
                    'route_id': route_id,
                    'sequence_order': deleted_seq,
                    'station_name': locals().get('station_name'),
                    'route_name': locals().get('route_name'),
                    'target_city': locals().get('city'),
                    'district': locals().get('district'),
                    'village': locals().get('village'),
                    'arrive_time': locals().get('arrive_time'),
                    'leave_time': locals().get('leave_time'),
                },
                cursor=cursor,
            )

            conn.commit()
        return jsonify({"status": "success", "message": "清運站點及其每週日程已自系統級聯抹除！"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"站點物理刪除失敗: {str(e)}"}), 500
    finally:
        conn.close()
