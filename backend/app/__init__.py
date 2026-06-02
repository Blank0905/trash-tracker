from flask import Flask, request, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
import decimal
import datetime
from config import Config
from app.db import check_db_health, get_table_structure, browse_table, get_db_connection

# 💡 核心武器：自訂 JSON 轉換器，自動把 Decimal 轉浮點數、time/timedelta 轉字串
class CustomJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        if isinstance(o, datetime.timedelta):
            total_seconds = int(o.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        return super().default(o)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 注入自訂的 JSON 處理器
    app.json_provider_class = CustomJSONProvider
    app.json = CustomJSONProvider(app)
    
    CORS(app)

    @app.route('/health')
    def health_check():
        return {'status': 'ok', 'message': 'Flask is running!'}

    @app.route('/api/db-status', methods=['GET'])
    def db_status():
        return jsonify({"connected": check_db_health()})

    @app.route('/api/db/browse', methods=['GET'])
    def api_browse():
        table = request.args.get('table')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 500))
        search = request.args.get('search', '')
        sort = request.args.get('sort', 'none')
        if not table:
            return jsonify({"error": "缺少 table 參數"}), 400
        try:
            # 這裡會回傳字典 {"total": X, "data": [...]}
            result = browse_table(table, page, limit, search, sort)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/db/structure', methods=['GET'])
    def api_structure():
        table = request.args.get('table')
        if not table:
            return jsonify({"error": "缺少 table 參數"}), 400
        try:
            structure = get_table_structure(table)
            return jsonify(structure)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/auth/admin/login', methods=['POST'])
    def api_admin_login():
        req_data = request.get_json() or {}
        email = req_data.get('email')
        password = req_data.get('password')
        
        if not email or not password:
            return jsonify({"message": "請填寫所有欄位"}), 400
            
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                sql = "SELECT `user_id`, `username`, `email`, `password_hash`, `role` FROM `users` WHERE `email` = %s"
                cursor.execute(sql, [email])
                user = cursor.fetchone()
                
                if not user or user['password_hash'] != password:
                    return jsonify({"message": "帳號或密碼輸入錯誤"}), 401
                    
                if user['role'] != 'admin':
                    return jsonify({"message": "權限不足，您並非管理員"}), 403
                    
                return jsonify({
                    "access_token": f"session_token_admin_{user['user_id']}",
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

    from app.api.routes import bp as stations_bp
    app.register_blueprint(stations_bp)

    return app