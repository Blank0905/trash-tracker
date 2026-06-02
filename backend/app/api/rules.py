from flask import Blueprint, request, jsonify
from app.db import get_db_connection
import pymysql

bp = Blueprint('rules', __name__, url_prefix='/api/rules')

# 1. 🔍 讀取指定縣市的大型垃圾規則
@bp.route('/get', methods=['GET'])
def get_city_rule():
    city = request.args.get('city')
    if not city:
        return jsonify({"status": "error", "message": "缺少必要的縣市參數"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = "SELECT title, content FROM bulky_waste_info WHERE city = %s LIMIT 1"
            cursor.execute(sql, (city,))
            rule = cursor.fetchone()
        
        # 💡 防禦機制：若全新的資料庫內尚未有該城市的法規數據，自動回傳空白範本給前端，防止崩潰
        if not rule:
            return jsonify({
                "title": f"{city}大型廢棄物清運指南及法規", 
                "content": "請在後台管理面板輸入此城市的詳細法規與預約步驟細則。"
            }), 200
            
        return jsonify(rule), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"資料庫讀取失敗: {str(e)}"}), 500
    finally:
        conn.close()

# 2. 💾 更新或新增指定縣市的法規內容
@bp.route('/update', methods=['POST'])
def update_city_rule():
    data = request.get_json(silent=True) or {}
    city = data.get('city')
    title = data.get('title')
    content = data.get('content')

    if not city or not title or not content:
        return jsonify({"status": "error", "message": "參數完整度不合法，拒絕變更"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 由於 city 在舊表沒有 UNIQUE 索引，我們用最穩固的「先查後動」邏輯
            check_sql = "SELECT info_id FROM bulky_waste_info WHERE city = %s"
            cursor.execute(check_sql, (city,))
            has_record = cursor.fetchone()

            if has_record:
                # 執行現有法規覆蓋更新 (UPDATE)
                update_sql = "UPDATE bulky_waste_info SET title = %s, content = %s WHERE city = %s"
                cursor.execute(update_sql, (title, content, city))
            else:
                # 執行全新的法規建檔 (INSERT)
                insert_sql = "INSERT INTO bulky_waste_info (city, title, content) VALUES (%s, %s, %s)"
                cursor.execute(insert_sql, (city, title, content))
                
            conn.commit()
        return jsonify({"status": "success", "message": "大型垃圾法規更新成功"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端儲存失敗: {str(e)}"}), 500
    finally:
        conn.close()