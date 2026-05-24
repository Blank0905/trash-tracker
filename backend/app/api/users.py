from flask import Blueprint, request, jsonify, render_template, g
from werkzeug.security import generate_password_hash
from app.db import get_db_connection
from app.utils.responses import ok
from app.utils.auth import line_required
from config import Config
import pymysql

bp = Blueprint('users', __name__, url_prefix='/api/users')

@bp.route('/register', methods=['GET'])
def show_register_page():
    # 渲染 HTML 並把 config.py 的 LIFF_ID 塞進去
    return render_template('register.html', liff_id=Config.LINE_LIFF_ID)

@bp.route('/register', methods=['POST'])
def register_user():
    """
    LINE 一鍵綁定（免帳密）：以 line_user_id 為核心識別寫入資料庫。
    預期收到的 JSON 格式:
    {
        "line_user_id": "U...",       # 必填，由 LIFF 取得
        "email": "test@example.com"   # 選填
    }
    一般使用者免帳密：username 與 password 皆不收（留 NULL）；
    username/password 欄位保留給日後管理員等帳密型帳號。
    """
    data = request.get_json()
    line_user_id = data.get('line_user_id') if data else None

    if not line_user_id:
        return jsonify({'status': 'error', 'message': '必須提供 line_user_id'}), 400

    username = data.get('username')
    email = data.get('email')
    raw_password = data.get('password')
    hashed_password = generate_password_hash(raw_password) if raw_password else None

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 檢查此 LINE 是否已綁定過
            cursor.execute("SELECT user_id FROM users WHERE line_user_id = %s", (line_user_id,))
            if cursor.fetchone():
                return jsonify({'status': 'error', 'message': '此 LINE 帳號已綁定過'}), 409

            # 寫入資料庫
            insert_sql = """
                INSERT INTO users (line_user_id, username, email, password_hash, role)
                VALUES (%s, %s, %s, %s, 'user')
            """
            cursor.execute(insert_sql, (line_user_id, username, email, hashed_password))
            
            conn.commit()
            new_user_id = cursor.lastrowid

            return jsonify({
                'status': 'success',
                'message': '綁定成功！',
                'data': {
                    'user_id': new_user_id,
                    'username': username
                }
            }), 201

    except Exception as e:
        conn.rollback() # 發生錯誤就退回，保護資料庫
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        conn.close()


@bp.route('/me', methods=['GET'])
@line_required
def get_me():
    """回傳目前 LINE 使用者的資料（依 X-Line-User-Id）。"""
    u = g.current_user
    return ok({
        'user_id': u['user_id'],
        'line_user_id': u['line_user_id'],
        'username': u['username'],
        'email': u['email'],
        'role': u['role'],
        'status': u['status'],
    })