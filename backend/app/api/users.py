from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash
import pymysql

from app.db import get_db_connection
from app.utils.responses import ok, err
from app.utils.auth import line_required, admin_required
from app.utils.audit import write_audit_log

bp = Blueprint('users', __name__, url_prefix='/api/users')


def _is_developer_operator():
    current = getattr(g, 'current_user', None) or {}
    user_id = current.get('user_id')
    if not user_id:
        return False

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
            me = cursor.fetchone()
            return bool(me and me.get('role') == 'developer')
    except Exception:
        return False
    finally:
        conn.close()


def _forbid_operating_developer(target_role):
    if target_role != 'developer':
        return None
    return jsonify({
        "status": "error",
        "message": "developer 帳號不可變更"
    }), 403


@bp.route('/me', methods=['GET'])
@line_required
def get_me():
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
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = data.get('password')

    if not email or not password:
        return err('請提供 email 與密碼', 400)
    if len(password) < 6:
        return err('密碼長度至少 6 碼', 400)

    user_id = g.current_user['user_id']
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM users WHERE email = %s AND user_id != %s",
                (email, user_id),
            )
            if cursor.fetchone():
                return err('此 email 已被其他使用者使用', 409)

            cursor.execute(
                "UPDATE users SET email = %s, password_hash = %s WHERE user_id = %s",
                (email, generate_password_hash(password), user_id),
            )
            conn.commit()
            return ok(None)
    except pymysql.err.IntegrityError as e:
        conn.rollback()
        if e.args and e.args[0] == 1062:
            return err('此 email 已被其他使用者使用', 409)
        return err(str(e), 500)
    except Exception as e:
        conn.rollback()
        return err(str(e), 500)
    finally:
        conn.close()


@bp.route('/list', methods=['GET'])
@admin_required
def get_users_list():
    conn = get_db_connection()
    try:
        current = getattr(g, 'current_user', None) or {}
        current_user_id = current.get('user_id')
        current_email = (current.get('email') or '').strip().lower()
        current_username = (current.get('username') or '').strip()
        operator_role = ''

        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                "SELECT user_id, username, email, role, status FROM users ORDER BY user_id ASC"
            )
            users_data = cursor.fetchall()
            matched_operator = None
            for row in users_data:
                row_email = (row.get('email') or '').strip().lower()
                row_username = (row.get('username') or '').strip()
                if current_user_id and row.get('user_id') == current_user_id:
                    matched_operator = row
                    break
                if current_email and row_email and row_email == current_email:
                    matched_operator = row
                    break
                if current_username and row_username and row_username == current_username:
                    matched_operator = row
                    break

            if matched_operator:
                operator_role = matched_operator.get('role') or ''
            elif current_user_id:
                cursor.execute("SELECT role FROM users WHERE user_id = %s", (current_user_id,))
                me = cursor.fetchone()
                operator_role = (me or {}).get('role') or ''

        can_demote_admins = operator_role == 'developer'

        return jsonify({
            "users": users_data,
            "operator_role": operator_role,
            "can_demote_admins": can_demote_admins,
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"資料庫讀取失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/promote', methods=['POST'])
@admin_required
def promote_user():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                "SELECT role, status, email, password_hash FROM users WHERE user_id = %s",
                (user_id,),
            )
            target = cursor.fetchone()
            if not target:
                return jsonify({"status": "error", "message": "找不到該使用者"}), 404
            blocked = _forbid_operating_developer(target.get('role'))
            if blocked:
                return blocked
            if target.get('status') == 'suspended':
                return jsonify({
                    "status": "error",
                    "message": "停權中的帳號不可提升為管理員，請先解除停權",
                }), 403
            if target.get('role') == 'admin':
                return jsonify({"status": "error", "message": "該使用者已是管理員"}), 400
            if not target.get('email') or not target.get('password_hash'):
                return jsonify({
                    "status": "error",
                    "message": "此使用者尚未完成帳密設定，禁止提升為管理員",
                }), 400

            cursor.execute("UPDATE users SET role = 'admin' WHERE user_id = %s", (user_id,))

            write_audit_log(
                'user_promote',
                target_type='user',
                target_id=user_id,
                details={'new_role': 'admin'},
                cursor=cursor,
            )

            conn.commit()
        return jsonify({"status": "success", "message": "權限變更成功"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/suspend', methods=['POST'])
@admin_required
def suspend_user():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT role, status FROM users WHERE user_id = %s", (user_id,))
            target_user = cursor.fetchone()
            if not target_user:
                return jsonify({"status": "error", "message": "找不到該使用者"}), 404
            blocked = _forbid_operating_developer(target_user.get('role'))
            if blocked:
                return blocked
            if target_user['role'] == 'admin':
                return jsonify({
                    "status": "error",
                    "message": "同級安全保護：管理員之間不得互相停權對方",
                }), 403
            if target_user['status'] == 'suspended':
                return jsonify({"status": "error", "message": "該使用者目前已是停權狀態"}), 400

            cursor.execute("UPDATE users SET status = 'suspended' WHERE user_id = %s", (user_id,))

            write_audit_log(
                'user_suspend',
                target_type='user',
                target_id=user_id,
                details={'previous_role': target_user['role']},
                cursor=cursor,
            )

            conn.commit()
        return jsonify({"status": "success", "message": "該用戶已成功停權"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/demote', methods=['POST'])
@admin_required
def demote_user():
    """
    將 admin 角色降回 user。
    僅 developer 可執行，避免一般 admin 互相降權。
    """
    if not _is_developer_operator():
        return jsonify({"status": "error", "message": "僅 developer 可調整管理員權限"}), 403

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
            target_user = cursor.fetchone()
            if not target_user:
                return jsonify({"status": "error", "message": "找不到該使用者"}), 404

            if target_user['role'] == 'developer':
                return jsonify({"status": "error", "message": "developer 帳號不可被降權"}), 403

            if target_user['role'] != 'admin':
                return jsonify({"status": "error", "message": "該使用者目前不是管理員"}), 400

            cursor.execute("UPDATE users SET role = 'user' WHERE user_id = %s", (user_id,))

            write_audit_log(
                'user_demote',
                target_type='user',
                target_id=user_id,
                details={'new_role': 'user'},
                cursor=cursor,
            )

            conn.commit()
        return jsonify({"status": "success", "message": "已將管理員降為一般用戶"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/unsuspend', methods=['POST'])
@admin_required
def unsuspend_user():
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"status": "error", "message": "缺少必要參數 user_id"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT role, status FROM users WHERE user_id = %s", (user_id,))
            target_user = cursor.fetchone()
            if not target_user:
                return jsonify({"status": "error", "message": "找不到該使用者"}), 404
            blocked = _forbid_operating_developer(target_user.get('role'))
            if blocked:
                return blocked
            if target_user['status'] != 'suspended':
                return jsonify({"status": "error", "message": "該使用者目前不是停權狀態"}), 400

            cursor.execute("UPDATE users SET status = 'active' WHERE user_id = %s", (user_id,))

            write_audit_log(
                'user_unsuspend',
                target_type='user',
                target_id=user_id,
                details={'role': target_user['role']},
                cursor=cursor,
            )

            conn.commit()
        return jsonify({"status": "success", "message": "該用戶已解除停權並恢復正常狀態"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端執行失敗: {str(e)}"}), 500
    finally:
        conn.close()
