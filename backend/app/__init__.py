import os
from flask import Flask
from flask_cors import CORS
from config import Config


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

    # 允許跨來源請求（前端 React / LIFF 會用到）
    CORS(app)

    @app.route('/health')
    def health_check():
        return {'status': 'ok', 'message': 'Flask is running!'}

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
