from flask import Blueprint, request, jsonify
from app.db import get_db_connection
import pymysql

# 🟢 獨立的後台管理藍圖，前綴採用 /api/admin/routes
bp = Blueprint('add_delete_route', __name__, url_prefix='/api/admin/routes')

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
def get_routes_list():
    """撈取所有路線，並支援選填 city, district, route_name 進行動態篩選"""
    # 🟢 從 URL 參數撈取選填的篩選條件
    city = request.args.get('city')
    district = request.args.get('district')
    keyword = request.args.get('keyword') or request.args.get('q') or request.args.get('route_name')
    search_fields = request.args.get('search_fields')

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 🟢 基底 SQL 語法，利用 WHERE 1=1 方便後面動態串接 AND
            sql = """
                SELECT r.route_id, r.areas_id, r.route_code, r.route_name, 
                       r.car_number, r.team, r.trip_number,
                       a.city, a.district
                FROM routes r
                INNER JOIN areas a ON r.areas_id = a.areas_id
                WHERE 1=1
            """
            params = []

            # 🟢 動態拼接安全防禦線
            if city and city != '全部':
                sql += " AND a.city = %s"
                params.append(city)
                
            if district and district != '':
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

            # 排序
            sql += " ORDER BY r.route_id DESC"

            # 執行帶有動態參數的查詢
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
# 2. 🌍 [後台專用] 讀取級聯選單區域清單 (village 為空)
# ==========================================
@bp.route('/areas/village-null', methods=['GET'])
def get_areas_village_null():
    """撈取村里為空的頂層行政區，供後台表單做『縣市->行政區』連動"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT areas_id, city, district 
                FROM areas 
                WHERE village IS NULL OR village = ''
                ORDER BY city ASC, district ASC
            """
            cursor.execute(sql)
            areas = cursor.fetchall()
        return jsonify({"status": "success", "areas": areas}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"後台級聯區域撈取失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 3. ➕ [後台專用] 新增清運收運路線 (含長度字數與必填防禦)
# ==========================================
@bp.route('/create', methods=['POST'])
def create_route():
    data = request.get_json(silent=True) or {}
    areas_id = data.get('areas_id')
    route_code = data.get('route_code')
    route_name = data.get('route_name')
    car_number = data.get('car_number')
    team = data.get('team')
    trip_number = data.get('trip_number')

    # 🛡️ 必填安全檢查
    if not areas_id or not route_code or not route_name:
        return jsonify({"status": "error", "message": "區域 ID、路線代碼與路線名稱為核心必填欄位！"}), 400

    # 🛡️ 字數限制防禦（對齊前端 30 字上限限制）
    for field_name, value in [('路線代碼', route_code), ('路線名稱', route_name), ('車牌號碼', car_number), ('所屬車隊', team), ('車次班次', trip_number)]:
        if value and len(str(value)) > 30:
            return jsonify({"status": "error", "message": f"欄位【{field_name}】超出 30 字元上限！"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            insert_sql = """
                INSERT INTO routes (areas_id, route_code, route_name, car_number, team, trip_number)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (
                int(areas_id),
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
        return jsonify({"status": "error", "message": f"資料庫寫入失敗: {str(e)}"}), 500
    finally:
        conn.close()


# ==========================================
# 4. 🗑️ [後台專用] 刪除收運路線 (高階連鎖刪除防禦 Transaction)
# ==========================================
@bp.route('/delete/<int:route_id>', methods=['POST', 'DELETE'])
def delete_route(route_id):
    """手動連鎖抹除線：由最底層的班次、站點、一路向上抹除到路線，防止 Fk 外鍵報錯"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # A. 物理蒸發該路線下所有站點的『每週班次日程 (station_schedules)』
            delete_schedules_sql = """
                DELETE FROM station_schedules 
                WHERE station_id IN (SELECT station_id FROM stations WHERE route_id = %s)
            """
            cursor.execute(delete_schedules_sql, [route_id])

            # B. 物理蒸發該路線下的所有『清運站點本體 (stations)』
            delete_stations_sql = "DELETE FROM stations WHERE route_id = %s"
            cursor.execute(delete_stations_sql, [route_id])

            # C. 最後抹除『收運路線本體 (routes)』
            delete_route_sql = "DELETE FROM routes WHERE route_id = %s"
            cursor.execute(delete_route_sql, [route_id])

            # 🟢 整個事務完全成功，一體化 Commit 提交
            conn.commit()
            
        return jsonify({"status": "success", "message": "收運路線及連帶之站點班次數據已安全連鎖清除！"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"連鎖刪除失敗: {str(e)}"}), 500
    finally:
        conn.close()
