"""管理者操作審計紀錄查詢 API（唯讀）

僅提供 GET 列表；寫入請走 app/utils/audit.write_audit_log()。
資料表設計見 database/migrate_admin_audit_log.sql。
"""
from flask import Blueprint, request

from app.db import get_db_connection
from app.utils.auth import admin_required
from app.utils.responses import ok, err

bp = Blueprint('audit', __name__, url_prefix='/api/admin/audit-log')


@bp.route('', methods=['GET'])
@admin_required
def list_audit_log():
    """列出 audit log（最新在前）。

    query：
      - limit（預設 50、上限 200）、offset（預設 0）
      - action / target_type：精準比對
      - actor_user_id：精準比對（需為整數）
    """
    try:
        limit = max(1, min(200, int(request.args.get('limit', 50))))
        offset = max(0, int(request.args.get('offset', 0)))
    except (ValueError, TypeError):
        return err('limit / offset 需為整數', 400)

    action = (request.args.get('action') or '').strip()
    target_type = (request.args.get('target_type') or '').strip()
    actor_raw = (request.args.get('actor_user_id') or '').strip()

    wheres = []
    params = []
    if action:
        wheres.append('action = %s')
        params.append(action)
    if target_type:
        wheres.append('target_type = %s')
        params.append(target_type)
    if actor_raw:
        try:
            params.append(int(actor_raw))
        except ValueError:
            return err('actor_user_id 需為整數', 400)
        wheres.append('actor_user_id = %s')

    where_sql = ('WHERE ' + ' AND '.join(wheres)) if wheres else ''

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM admin_audit_log {where_sql}",
                params,
            )
            total = cursor.fetchone()['total']

            cursor.execute(
                f"""
                SELECT log_id, actor_user_id, actor_email, action,
                       target_type, target_id, details, ip_address, created_at
                FROM admin_audit_log
                {where_sql}
                ORDER BY log_id DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cursor.fetchall()

        # details 維持字串原樣（前端 JSON.parse）；created_at 由 CustomJSONProvider 轉 ISO
        return ok(rows, total=total, limit=limit, offset=offset)

    except Exception as e:
        return err(str(e), 500)

    finally:
        conn.close()
