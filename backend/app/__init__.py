from flask import Flask
from flask_cors import CORS
from config import Config


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

    return app
