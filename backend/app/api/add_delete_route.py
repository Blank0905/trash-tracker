from flask import Blueprint, request, jsonify
from app.db import get_db_connection
from app.utils.auth import admin_required
from app.utils.audit import write_audit_log
import pymysql

# 🟢 獨立的後台管理藍圖，前綴採用 /api/admin/routes
bp = Blueprint('add_delete_route', __name__, url_prefix='/api/admin/routes')

def _clean_text(value):
    if value is None:
        return ''
    return str(value).strip()

SEARCHABLE_ROUTE_FIELDS = {
    'route_name': 'r.route_name',
    'route_code': 'r.route_code',
    'car_number': 'r.car_number',
    'team': 'r.team',
    'trip_number': 'r.trip_number',
    'city': 'a.city',
    'district': 'a.district',
}


def _normalize_text(raw):
    if raw is None:
        return ''
    return str(raw).strip()


def _build_terms(raw):
    base = _normalize_text(raw)
    if not base:
        return []
    return [base]


def _parse_search_fields(raw):
    if not raw:
        return ['route_name']

    fields = [f.strip() for f in str(raw).split(',') if f.strip()]
    invalid = [f for f in fields if f not in SEARCHABLE_ROUTE_FIELDS]
    if invalid:
        raise ValueError(f"無效 search_fields 欄位: {', '.join(invalid)}")

    deduped = []
    for field in fields:
        if field not in deduped:
            deduped.append(field)
    return deduped

# ==========================================
# 1. 📋 [後台專用] 讀取目前系統中現存路線一覽
# ==========================================
@bp.route('/list', methods=['GET'])
@admin_required
def get_routes_list():
    """撈取所有路線，並支援選填 city, district, route_name 進行動態篩選"""
    city = request.args.get('city')
    district = request.args.get('district')
    route_name = _normalize_text(request.args.get('route_name'))
    keyword = _normalize_text(request.args.get('keyword') or request.args.get('q') or route_name)
    search_fields = request.args.get('search_fields')
    latest = request.args.get('latest')
    limit = request.args.get('limit', '50')

    has_filter = (city and city != '全部') or (district and district.strip() != '') or bool(keyword)
    latest_mode = latest == '1' or not has_filter

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT r.route_id, r.areas_id, r.route_code, r.route_name,
                       r.car_number, r.team, r.trip_number,
                       a.city, a.district
                FROM routes r
                INNER JOIN areas a ON r.areas_id = a.areas_id
                WHERE 1=1
            """
            params = []

            if city and city != '全部':
                sql += " AND a.city = %s"
                params.append(city)

            if district and district.strip() != '':
                sql += " AND a.district = %s"
                params.append(district)

            if keyword:
                selected_fields = _parse_search_fields(search_fields)
                terms = _build_terms(keyword)
                term_sql_parts = []

                for field in selected_fields:
                    expr = SEARCHABLE_ROUTE_FIELDS[field]

                    for term in terms:
                        term_sql_parts.append(f"{expr} COLLATE utf8mb4_unicode_ci LIKE %s")
                        params.append(f"%{term}%")

                if term_sql_parts:
                    sql += " AND (" + " OR ".join(term_sql_parts) + ")"

            sql += " ORDER BY r.route_id DESC"

            if latest_mode:
                try:
                    limit_value = max(1, min(50, int(limit)))
                except (TypeError, ValueError):
                    limit_value = 50
                sql += " LIMIT %s"
                params.append(limit_value)

            cursor.execute(sql, params)
            routes = cursor.fetchall()

        return jsonify({"status": "success", "routes": routes}), 200
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": f"後台收運路線篩選失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 2. 🌍 [後台專用] 讀取「沒村里」的行政區清單
# ==========================================
@bp.route('/areas/village-null', methods=['GET'])
@admin_required
def get_areas_districts():
    """撈取村里為空的頂層行政區，供後台表單做『縣市->行政區』連動"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT MIN(areas_id) AS areas_id, city, district
                FROM areas
                WHERE village IS NULL OR village = ''
                GROUP BY city, district
                ORDER BY city ASC, district ASC
            """
            cursor.execute(sql)
            areas = cursor.fetchall()
        return jsonify({"status": "success", "areas": areas}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"後台行政區撈取失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 3. ➕ [後台專用] 新增清運收運路線 (含長度字數與必填防禦)
# ==========================================
@bp.route('/create', methods=['POST'])
@admin_required
def create_route():
    data = request.get_json(silent=True) or {}
    areas_id = data.get('areas_id')
    route_code = _clean_text(data.get('route_code'))
    route_name = _clean_text(data.get('route_name'))
    car_number = _clean_text(data.get('car_number'))
    team = _clean_text(data.get('team'))
    trip_number = _clean_text(data.get('trip_number'))

    try:
        areas_id = int(areas_id)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "區域 ID 必須是有效整數！"}), 400

    if areas_id <= 0 or not route_code or not route_name:
        return jsonify({"status": "error", "message": "區域 ID、路線代碼與路線名稱為核心必填欄位！"}), 400

    for field_name, value in [('路線代碼', route_code), ('路線名稱', route_name), ('車牌號碼', car_number), ('所屬車隊', team), ('車次班次', trip_number)]:
        if value and len(str(value)) > 30:
            return jsonify({"status": "error", "message": f"欄位【{field_name}】超出 30 字元上限！"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            print(f"[create_route] payload={data}")
            duplicate_sql = """
                SELECT route_id
                FROM routes
                WHERE areas_id = %s
                  AND route_code = %s
                  AND route_name = %s
                  AND COALESCE(car_number, '') = COALESCE(%s, '')
                  AND COALESCE(team, '') = COALESCE(%s, '')
                  AND COALESCE(trip_number, '') = COALESCE(%s, '')
                LIMIT 1
            """
            cursor.execute(duplicate_sql, (
                areas_id,
                route_code,
                route_name,
                car_number if car_number else None,
                team if team else None,
                trip_number if trip_number else None
            ))
            duplicate_route = cursor.fetchone()
            if duplicate_route:
                print("[create_route] blocked_reason=duplicate_route")
                return jsonify({
                    "status": "error",
                    "error_type": "duplicate",
                    "blocked_reason": "duplicate_route",
                    "duplicate_key": {
                        "areas_id": areas_id,
                        "route_code": route_code,
                        "route_name": route_name
                    },
                    "message": "資料完全重複，已存在相同路線記錄，禁止重複新增！"
                }), 409

            insert_sql = """
                INSERT INTO routes (areas_id, route_code, route_name, car_number, team, trip_number)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (
                areas_id,
                route_code,
                route_name,
                car_number if car_number else None,
                team if team else None,
                trip_number if trip_number else None
            ))
            conn.commit()
        return jsonify({"status": "success", "message": "全新收運路線已安全寫入資料庫！"}), 201
    except Exception as e:
        conn.rollback()
        print(f"[create_route] error={type(e).__name__}: {e}")
        return jsonify({"status": "error", "message": f"資料庫寫入失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 4. 🗑️ [後台專用] 刪除收運路線 (高階連鎖刪除防禦 Transaction)
# ==========================================
@bp.route('/delete/<int:route_id>', methods=['POST', 'DELETE'])
@admin_required
def delete_route(route_id):
    """手動連鎖抹除線：由最底層的班次、站點、一路向上抹除到路線，防止 Fk 外鍵報錯"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            delete_schedules_sql = """
                DELETE FROM station_schedules
                WHERE station_id IN (SELECT station_id FROM stations WHERE route_id = %s)
            """
            cursor.execute(delete_schedules_sql, [route_id])

            delete_stations_sql = "DELETE FROM stations WHERE route_id = %s"
            cursor.execute(delete_stations_sql, [route_id])

            delete_route_sql = "DELETE FROM routes WHERE route_id = %s"
            cursor.execute(delete_route_sql, [route_id])

            write_audit_log(
                'route_delete',
                target_type='route',
                target_id=route_id,
                cursor=cursor,
            )

            conn.commit()

        return jsonify({"status": "success", "message": "收運路線及連帶之站點班次數據已安全連鎖清除！"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"連鎖刪除失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/areas/all', methods=['GET'])
@admin_required
def get_all_areas():
    """撈取資料庫內完整的縣市、行政區、村里資料，供站點端與搜尋端進行三級級聯連動"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT areas_id, city, district, village
                FROM areas
                WHERE village IS NOT NULL AND village != ''
                ORDER BY city ASC, district ASC, village ASC
            """
            cursor.execute(sql)
            areas = cursor.fetchall()
        return jsonify({"status": "success", "areas": areas}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"後台村里區域撈取失敗: {str(e)}"}), 500
    finally:
        conn.close()
