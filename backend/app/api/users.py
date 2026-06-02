from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash
from app.db import get_db_connection
from app.utils.responses import ok, err
from app.utils.auth import line_required
import pymysql

bp = Blueprint('users', __name__, url_prefix='/api/users')

# 註：LIFF 註冊頁 HTML 改由通用路由 GET /liff/register 提供（見 app/api/pages.py）；
#     本檔只保留純 JSON API（register 寫入 / me / credentials）。

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


@bp.route('/credentials', methods=['PUT'])
@line_required
def set_credentials():
    """設定 / 更新本人的 email 與密碼（credentials.html 表單送出目標）。

    body: { "email": "a@b.com", "password": "至少6碼" }
    email 與其他人重複時回 409。
    """
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = data.get('password')

    if not email or not password:
        return err('請提供 email 與密碼', 400)
    if len(password) < 6:
        return err('密碼至少需 6 碼', 400)

    user_id = g.current_user['user_id']
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # email 為 UNIQUE，不可與其他使用者重複
            cursor.execute(
                "SELECT user_id FROM users WHERE email = %s AND user_id != %s",
                (email, user_id)
            )
            if cursor.fetchone():
                return err('此 email 已被使用', 409)

            cursor.execute(
                "UPDATE users SET email = %s, password_hash = %s WHERE user_id = %s",
                (email, generate_password_hash(password), user_id)
            )
            conn.commit()
            return ok(None)

    except pymysql.err.IntegrityError as e:
        conn.rollback()
        # 1062 = Duplicate entry（email UNIQUE 撞號的兜底）
        if e.args and e.args[0] == 1062:
            return err('此 email 已被使用', 409)
        return err(str(e), 500)
    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        conn.close()


# ─── 以下為全新加裝的管理者高階控制端點 ───

@bp.route('/list', methods=['GET'])
def get_users_list():
    """
    📊 讀取實體資料庫的所有用戶清單
    前端 UsersManage.jsx 呼叫目標
    """
    conn = get_db_connection()
    try:
        # 強制使用 DictCursor，將撈出來的資料自動封裝成前端 React 最愛的 {} 物件型態
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = "SELECT user_id, username, email, role, status FROM users ORDER BY user_id ASC"
            cursor.execute(sql)
            users_data = cursor.fetchall()
            
        return jsonify({"users": users_data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"資料庫讀取失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/promote', methods=['POST'])
def promote_user():
    """
    🔼 權限升等：將指定的一般用戶提升為管理員 (Admin)
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "UPDATE users SET role = 'admin' WHERE user_id = %s"
            cursor.execute(sql, (user_id,))
            conn.commit()
            
        return jsonify({"status": "success", "message": "權限變更成功"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/suspend', methods=['POST'])
def suspend_user():
    """
    🚫 違規懲處：將違規用戶黑名單停權
    🛡️ 安全限制：管理員同級互不侵犯保護機制
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400
        
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 1. 第一重防禦：先向資料庫調閱該目標使用者的真實權限
            check_sql = "SELECT role FROM users WHERE user_id = %s"
            cursor.execute(check_sql, (user_id,))
            target_user = cursor.fetchone()
            
            if not target_user:
                return jsonify({"status": "error", "message": "找不到該使用者"}), 404
                
            # 2. 🚨 核心平權捍衛：若目標身份已經是 admin，後端硬性攔截並駁回，不允許互相停權！
            if target_user['role'] == 'admin':
                return jsonify({"status": "error", "message": "同級安全保護：管理員之間不得互相停權對方！"}), 403
                
            # 3. 安全通關，執行停權
            update_sql = "UPDATE users SET status = 'suspended' WHERE user_id = %s"
            cursor.execute(update_sql, (user_id,))
            conn.commit()
            
        return jsonify({"status": "success", "message": "該用戶已成功移入黑名單停權"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()