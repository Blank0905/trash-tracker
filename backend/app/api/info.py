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
    """垃圾袋規範。query: city?（不帶則回全部）
    data: [{ reg_id, city, bag_size, volume_liters, price, purchase_locations, notes }]
    """
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

        for row in rows:
            if row.get('volume_liters') is not None:
                row['volume_liters'] = float(row['volume_liters'])
            if row.get('price') is not None:
                row['price'] = float(row['price'])

        return ok(rows, count=len(rows))
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()


@bp.route('/bulky-waste', methods=['GET'])
def bulky_waste():
    """大型廢棄物清運資訊。query: city?
    data: [{ info_id, city, title, content, updated_at }]
    """
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

        for row in rows:
            if row.get('updated_at') is not None:
                row['updated_at'] = str(row['updated_at'])

        return ok(rows, count=len(rows))
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()


@bp.route('/announcements', methods=['GET'])
def announcements():
    """環保政策公告（給使用者看）。query: city?
    回傳 target_city 為 NULL（全體）或符合 city 者，新到舊排序。
    data: [{ announcement_id, title, content, target_city, created_at }]
    """
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

        for row in rows:
            if row.get('created_at') is not None:
                row['created_at'] = str(row['created_at'])

        return ok(rows, count=len(rows))
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()
