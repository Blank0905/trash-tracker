from flask import Flask, request, jsonify
from flask.json.provider import DefaultJSONProvider
import os
from flask import Flask
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


def _start_scheduler(app):
    """啟動 APScheduler 背景排程：到站推播（每 60 秒）、ETL 同步（每日 02:00）、去重快取清理。"""
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.tasks.notifier import check_and_send_notifications, clear_expired_notified_set
    from app.tasks.data_sync import execute_daily_data_sync

    def _with_context(func):
        # 背景執行緒需自行推入 app context（line_service 會讀 current_app.config）
        def wrapper():
            with app.app_context():
                func()
        return wrapper

    scheduler = BackgroundScheduler(timezone="Asia/Taipei")
    scheduler.add_job(_with_context(check_and_send_notifications), 'interval', seconds=60, id='notifier')
    scheduler.add_job(_with_context(execute_daily_data_sync), 'cron', hour=2, minute=0, id='data_sync')
    scheduler.add_job(_with_context(clear_expired_notified_set), 'cron', hour=0, minute=5, id='clear_notified')
    scheduler.start()
    app.scheduler = scheduler


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 注入自訂的 JSON 處理器
    app.json_provider_class = CustomJSONProvider
    app.json = CustomJSONProvider(app)
    

    # 允許跨來源請求（前端 React / LIFF 會用到）
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

    # 一次註冊所有 Blueprint（地基已建好；各組員只需填自己的檔，不必再動本檔）
    from app.api.routes import bp as stations_bp
    from app.api.users import bp as users_bp
    from app.api.webhooks import bp as line_bp
    from app.api.favorites import bp as favorites_bp
    from app.api.notifications import bp as notifications_bp
    from app.api.info import bp as info_bp
    from app.api.admin import bp as admin_bp
    from app.api.pages import bp as pages_bp

    for blueprint in (
        stations_bp, users_bp, line_bp, favorites_bp,
        notifications_bp, info_bp, admin_bp, pages_bp,
    ):
        app.register_blueprint(blueprint)

    # 啟動背景排程。設環境變數 DISABLE_SCHEDULER=1 可停用（便於測試）。
    # debug reloader 下只在實際工作子程序啟動一次，避免父子程序重複排程。
    if os.environ.get("DISABLE_SCHEDULER") != "1" and (
        not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    ):
        _start_scheduler(app)

    return app