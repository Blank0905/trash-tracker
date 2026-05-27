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
            if city:
                cursor.execute(
                    """
                    SELECT reg_id, city, bag_size, volume_liters, price, purchase_locations, notes
                    FROM bag_regulations
                    WHERE city = %s
                    ORDER BY reg_id ASC
                    """,
                    (city,)
                )
            else:
                cursor.execute(
                    """
                    SELECT reg_id, city, bag_size, volume_liters, price, purchase_locations, notes
                    FROM bag_regulations
                    ORDER BY reg_id ASC
                    """
                )

            rows = cursor.fetchall()
            data = []

            for row in rows:
                reg_id, city, bag_size, volume_liters, price, purchase_locations, notes = row

                data.append({
                    'reg_id': reg_id,
                    'city': city,
                    'bag_size': bag_size,
                    'volume_liters': float(volume_liters) if volume_liters is not None else None,
                    'price': float(price) if price is not None else None,
                    'purchase_locations': purchase_locations,
                    'notes': notes
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
                info_id, city, title, content, updated_at = row

                data.append({
                    'info_id': info_id,
                    'city': city,
                    'title': title,
                    'content': content,
                    'updated_at': str(updated_at) if updated_at is not None else None
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()


@bp.route('/announcements', methods=['GET'])
def announcements():
    """環保政策公告。query: city?"""
    city = request.args.get('city')
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            if city:
                cursor.execute(
                    """
                    SELECT announcement_id, title, content, target_city, created_at
                    FROM announcements
                    WHERE target_city IS NULL OR target_city = %s
                    ORDER BY created_at DESC
                    """,
                    (city,)
                )
            else:
                cursor.execute(
                    """
                    SELECT announcement_id, title, content, target_city, created_at
                    FROM announcements
                    WHERE target_city IS NULL
                    ORDER BY created_at DESC
                    """
                )

            rows = cursor.fetchall()
            data = []

            for row in rows:
                announcement_id, title, content, target_city, created_at = row

                data.append({
                    'announcement_id': announcement_id,
                    'title': title,
                    'content': content,
                    'target_city': target_city,
                    'created_at': str(created_at) if created_at is not None else None
                })

            return ok(data, count=len(data))

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()
