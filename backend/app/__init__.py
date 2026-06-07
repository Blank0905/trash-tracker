from flask import Flask, request, jsonify
from flask.json.provider import DefaultJSONProvider
import os
from dotenv import load_dotenv

# 載入 backend/.env（須在 import app.db 之前，確保 os.environ 已有 DB 設定）
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from flask import Flask
from flask_cors import CORS
import decimal
import datetime
from app.db import check_db_health, get_table_structure, browse_table, get_db_connection
from app.utils.auth import admin_required, generate_admin_token
#這邊是雜湊後要登入所以加的
from werkzeug.security import check_password_hash

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
        # 背景執行緒需自行推入 app context（任務內會用到 current_app / DB 連線）
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

#阿因為我想要雜湊過或本來預設的都可以用 所以才這樣寫
def verify_password(input_password: str, stored_password: str) -> bool:
    if not stored_password:
        return False

    #  照你的超讚邏輯：先嘗試跑 Flask 官方的雜湊驗證（完美支援 scrypt）
    try:
        if check_password_hash(stored_password, input_password):
            return True
    except Exception:
        # 如果資料庫裡是純文字（如 abc123），check_password_hash 會因為格式不符而噴錯
        # 這時候我們直接 pass，讓程式碼往下走純文字比對
        pass

    #  備用方案：如果雜湊沒過，或是舊的明文資料，就直接進行字串比對
    return input_password == stored_password

def create_app():
    app = Flask(__name__)

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
    @admin_required
    def api_browse():
        table = request.args.get('table')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 500))
        search = request.args.get('search', '')
        search_fields = request.args.get('search_fields', '')
        sort = request.args.get('sort', 'none')
        if not table:
            return jsonify({"error": "缺少 table 參數"}), 400
        try:
            # 這裡會回傳字典 {"total": X, "data": [...]}
            result = browse_table(table, page, limit, search, sort, search_fields)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/db/structure', methods=['GET'])
    @admin_required
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

        #有點不愛打@gmail.com 所以自動補齊xixi
        if email and '@' not in email:
            email = f"{email}@gmail.com"
        
        if not email or not password:
            return jsonify({"message": "請填寫所有欄位"}), 400
            
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                sql = "SELECT `user_id`, `username`, `email`, `password_hash`, `role` FROM `users` WHERE `email` = %s"
                cursor.execute(sql, [email])
                user = cursor.fetchone()
                
                # 這裡改成用 verify_password 函式
                # 如果找不到使用者，或者密碼驗證失敗（不管是明文還是雜湊），都阻擋掉
                if not user or not verify_password(password, user['password_hash']):
                    return jsonify({"message": "帳號或密碼輸入錯誤"}), 401
                    
                if user['role'] != 'admin':
                    return jsonify({"message": "權限不足，您並非管理員"}), 403
                    
                return jsonify({
                    "access_token": generate_admin_token(user),
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
    from app.api.info import bp as info_bp
    from app.api.pages import bp as pages_bp
    from app.api.announcements import bp as announcements_bp
    from app.api.rules import bp as rules_bp
    from app.api.me import bp as me_bp
    from app.api.etl import bp as etl_bp
    from app.api.add_delete_route import bp as add_delete_route_bp
    from app.api.bags import bp as bags_bp
    from app.api.add_delete_station import bp as add_delete_station_bp

    for blueprint in (
        stations_bp, users_bp, line_bp,
        info_bp, pages_bp, announcements_bp, rules_bp, me_bp, etl_bp, add_delete_route_bp, bags_bp, add_delete_station_bp
    ):
        app.register_blueprint(blueprint)

    # 啟動背景排程。設環境變數 DISABLE_SCHEDULER=1 可停用（便於測試）。
    # debug reloader 下只在實際工作子程序啟動一次，避免父子程序重複排程。
    if os.environ.get("DISABLE_SCHEDULER") != "1" and (
        not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    ):
        _start_scheduler(app)

    return app
