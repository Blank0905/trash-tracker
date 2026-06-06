"""垃圾袋規範（bag_regulations）後台寫入端點。

讀取沿用公開的 GET /api/info/bag-regulations?city=（含 reg_id）；
這裡只提供管理者用的新增／修改／刪除。city 僅限台北市、新北市（對齊 DB enum）。
"""
from flask import Blueprint, request, jsonify
from app.db import get_db_connection

bp = Blueprint('bags', __name__, url_prefix='/api/admin/bag-regulations')

ALLOWED_CITIES = ('台北市', '新北市')


def _clean(data):
    """整理並驗證輸入；回傳 (fields, error_message)。"""
    city = (data.get('city') or '').strip()
    bag_size = (data.get('bag_size') or '').strip()
    if city not in ALLOWED_CITIES:
        return None, "縣市僅限台北市或新北市"
    if not bag_size:
        return None, "請填寫袋子規格（bag_size）"

    def num_or_none(v):
        return None if v in (None, '') else v

    fields = {
        'city': city,
        'bag_size': bag_size,
        'volume_liters': num_or_none(data.get('volume_liters')),
        'price': num_or_none(data.get('price')),
        'purchase_locations': num_or_none(data.get('purchase_locations')),
        'notes': num_or_none(data.get('notes')),
    }
    return fields, None


@bp.route('', methods=['POST'])
def create_bag():
    fields, errmsg = _clean(request.get_json(silent=True) or {})
    if errmsg:
        return jsonify({"status": "error", "message": errmsg}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """INSERT INTO bag_regulations
                   (city, bag_size, volume_liters, price, purchase_locations, notes)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (fields['city'], fields['bag_size'], fields['volume_liters'],
                 fields['price'], fields['purchase_locations'], fields['notes'])
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

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """UPDATE bag_regulations
                   SET city=%s, bag_size=%s, volume_liters=%s, price=%s,
                       purchase_locations=%s, notes=%s
                   WHERE reg_id=%s""",
                (fields['city'], fields['bag_size'], fields['volume_liters'],
                 fields['price'], fields['purchase_locations'], fields['notes'], reg_id)
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
