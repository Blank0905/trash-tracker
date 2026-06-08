"""資訊查詢 API（公開，不需身分）（負責人：P2）

垃圾袋規範 / 大型廢棄物清運資訊 / 環保政策公告。
資料表：bag_regulations、bulky_waste_info、announcements。
"""
from flask import Blueprint, request
from app.utils.responses import ok, err
from app.db import get_db_connection

bp = Blueprint('info', __name__, url_prefix='/api/info')


@bp.route('/bag-regulations', methods=['GET'])
def bag_regulations():
    """垃圾袋規範。query: city?（不帶則回全部）"""
    city = request.args.get('city')
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cols = """reg_id, city, category, name, volume_liters, units_per_pack,
                      price_per_pack, unit_price, style, purchase_locations, notes"""
            if city:
                cursor.execute(
                    f"SELECT {cols} FROM bag_regulations WHERE city = %s ORDER BY reg_id ASC",
                    (city,)
                )
            else:
                cursor.execute(f"SELECT {cols} FROM bag_regulations ORDER BY reg_id ASC")

            rows = cursor.fetchall()
            data = []

            for row in rows:
                data.append({
                    'reg_id': row['reg_id'],
                    'city': row['city'],
                    'category': row['category'],
                    'name': row['name'],
                    'volume_liters': float(row['volume_liters']) if row['volume_liters'] is not None else None,
                    'units_per_pack': row['units_per_pack'],
                    'price_per_pack': float(row['price_per_pack']) if row['price_per_pack'] is not None else None,
                    'unit_price': float(row['unit_price']) if row['unit_price'] is not None else None,
                    'style': row['style'],
                    'purchase_locations': row['purchase_locations'],
                    'notes': row['notes'],
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/bulky-waste', methods=['GET'])
def bulky_waste():
    """大型廢棄物清運資訊。query: city?"""
    city = request.args.get('city')
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            if city:
                cursor.execute(
                    """
                    SELECT info_id, city, title, content, updated_at
                    FROM bulky_waste_info
                    WHERE city = %s
                    ORDER BY updated_at DESC
                    """,
                    (city,)
                )
            else:
                cursor.execute(
                    """
                    SELECT info_id, city, title, content, updated_at
                    FROM bulky_waste_info
                    ORDER BY updated_at DESC
                    """
                )

            rows = cursor.fetchall()
            data = []

            for row in rows:
                data.append({
                    'info_id': row['info_id'],
                    'city': row['city'],
                    'title': row['title'],
                    'content': row['content'],
                    'updated_at': str(row['updated_at']) if row['updated_at'] is not None else None
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


