"""垃圾袋規範（bag_regulations）後台寫入端點。

讀取沿用公開的 GET /api/info/bag-regulations?city=（含 reg_id）；
這裡只提供管理者用的新增／修改／刪除。city 僅限台北市、新北市（對齊 DB enum）。
"""
from flask import Blueprint, request, jsonify
from app.db import get_db_connection

bp = Blueprint('bags', __name__, url_prefix='/api/admin/bag-regulations')

ALLOWED_CITIES = ('台北市', '新北市')
ALLOWED_CATEGORIES = ('一般專用', '環保兩用')

# 寫入欄位（city、name 必填；其餘可空）
FIELDS = ('city', 'category', 'name', 'volume_liters', 'units_per_pack',
          'price_per_pack', 'unit_price', 'style', 'purchase_locations', 'notes')


def _clean(data):
    """整理並驗證輸入；回傳 (fields_dict, error_message)。"""
    city = (data.get('city') or '').strip()
    name = (data.get('name') or '').strip()
    category = (data.get('category') or '一般專用').strip()
    if city not in ALLOWED_CITIES:
        return None, "縣市僅限台北市或新北市"
    if category not in ALLOWED_CATEGORIES:
        return None, "類別僅限一般專用或環保兩用"
    if not name:
        return None, "請填寫名稱（name）"

    def none_if_blank(v):
        return None if v in (None, '') else v

    fields = {
        'city': city,
        'category': category,
        'name': name,
        'volume_liters': none_if_blank(data.get('volume_liters')),
        'units_per_pack': none_if_blank(data.get('units_per_pack')),
        'price_per_pack': none_if_blank(data.get('price_per_pack')),
        'unit_price': none_if_blank(data.get('unit_price')),
        'style': none_if_blank(data.get('style')),
        'purchase_locations': none_if_blank(data.get('purchase_locations')),
        'notes': none_if_blank(data.get('notes')),
    }
    return fields, None


@bp.route('', methods=['POST'])
def create_bag():
    fields, errmsg = _clean(request.get_json(silent=True) or {})
    if errmsg:
        return jsonify({"status": "error", "message": errmsg}), 400

    placeholders = ", ".join(["%s"] * len(FIELDS))
    columns = ", ".join(FIELDS)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"INSERT INTO bag_regulations ({columns}) VALUES ({placeholders})",
                tuple(fields[f] for f in FIELDS)
            )
            conn.commit()
            return jsonify({"status": "success", "message": "新增成功",
                            "data": {"reg_id": cursor.lastrowid}}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"新增失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/<int:reg_id>', methods=['PUT'])
def update_bag(reg_id):
    fields, errmsg = _clean(request.get_json(silent=True) or {})
    if errmsg:
        return jsonify({"status": "error", "message": errmsg}), 400

    set_clause = ", ".join(f"{f}=%s" for f in FIELDS)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE bag_regulations SET {set_clause} WHERE reg_id=%s",
                tuple(fields[f] for f in FIELDS) + (reg_id,)
            )
            conn.commit()
            return jsonify({"status": "success", "message": "更新成功"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"更新失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/<int:reg_id>', methods=['DELETE'])
def delete_bag(reg_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM bag_regulations WHERE reg_id=%s", (reg_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"status": "error", "message": "找不到該筆規範"}), 404
            return jsonify({"status": "success", "message": "刪除成功"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"刪除失敗: {str(e)}"}), 500
    finally:
        conn.close()
