from flask import Flask, request, jsonify
from flask_cors import CORS
import db_admin  # 匯入剛剛寫好的資料庫操控層

app = Flask(__name__)
CORS(app)  # 🔴 關鍵：允許前端跨網域存取 API

@app.route('/api/db-status', methods=['GET'])
def db_status():
    """1. 連線狀態檢查端點 (對應前端的紅綠燈)"""
    is_alive = db_admin.check_db_health()
    return jsonify({"connected": is_alive})

@app.route('/api/db/browse', methods=['GET'])
def api_browse():
    """2. 萬能資料瀏覽 API"""
    table = request.args.get('table')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 500))
    search = request.args.get('search', '')
    sort = request.args.get('sort', 'none')
    
    if not table:
        return jsonify({"error": "Missing 'table' parameter"}), 400
        
    try:
        data = db_admin.browse_table(table, page, limit, search, sort)
        return jsonify(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/api/db/structure', methods=['GET'])
def api_structure():
    """3. 萬能資料表結構 API"""
    table = request.args.get('table')
    
    if not table:
        return jsonify({"error": "Missing 'table' parameter"}), 400
        
    try:
        structure = db_admin.get_table_structure(table)
        return jsonify(structure)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

if __name__ == '__main__':
    # 啟動在 Port 8000
    app.run(host='0.0.0.0', port=8000, debug=True)

@app.route('/api/auth/admin/login', methods=['POST'])
def api_admin_login():
    req_data = request.get_json()
    email = req_data.get('email')
    password = req_data.get('password') # 前端傳過來的明文密碼
    
    if not email or !password:
        return jsonify({"message": "請填寫所有欄位"}), 400
        
    conn = db_admin.get_connection()
    try:
        with conn.cursor() as cursor:
            # 依據你的實體 SQL：查詢符合 email 且 role 為 admin 的使用者
            sql = "SELECT `user_id`, `username`, `email`, `password_hash`, `role` FROM `users` WHERE `email` = %s"
            cursor.execute(sql, [email])
            user = cursor.fetchone()
            
            if not user:
                return jsonify({"message": "帳號不存在或權限不足"}), 401
                
            # 🛠️ 密碼比對邏輯：
            # 實際專題通常使用 bcrypt.check_password_hash(user['password_hash'], password)
            # 這裡先示範最直覺的字串比對，請根據你們資料庫存放的是明文還是雜湊值調整
            if user['password_hash'] != password:
                return jsonify({"message": "密碼輸入錯誤"}), 401
                
            if user['role'] != 'admin':
                return jsonify({"message": "此權限無法登入管理後台"}), 403
                
            # 完全符合條件，打包符合 phpMyAdmin 要求的 Token 回傳
            return jsonify({
                "access_token": f"mock_jwt_token_for_user_{user['user_id']}",
                "token_type": "bearer",
                "user": {
                    "user_id": user['user_id'],
                    "username": user['username'],
                    "email": user['email'],
                    "role": user['role']
                }
            }), 200
    finally:
        conn.close()