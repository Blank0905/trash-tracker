from flask import Blueprint, request, jsonify
from app.db import get_db_connection
from app.utils.auth import admin_required
from app.utils.audit import write_audit_log
# 💡 依賴規格：引入 P3 的 LINE 核心群發服務
import pymysql
import re
from datetime import datetime
from zoneinfo import ZoneInfo

# ─── 💡 依賴規格相容性防禦線 ───
try:
    #  1. 嘗試引入組員承諾要給的實例化物件
    from app.services.line_service import line_service
except ImportError:
    # 🛡️ 隊友防禦機制：如果組員程式碼還沒到位、改名或漏寫，自動開啟「物件導向攔截模擬器」
    import logging
    logging.warning("⚠️ [相容警報] 無法從 line_service 讀取 line_service 物件。已自動切換為後台安全模擬發送模式。")
    
    # 建立一個假的類別，模仿真實 line_service 的行為與方法名稱
    class MockLineService:
        def multicast_text(self, line_user_ids: list, text: str) -> bool:
            """
            當組員那邊掉鏈子時，這個模擬器會接管物件調度，確保主程式執行不噴 500！
            """
            print("\n" + "="*50)
            print("📡 [LINE 核心群發攔截成功] 偵測到高階公告推播調度（模擬器）！")
            print(f"👥 發送對象：實體資料庫內共 {len(line_user_ids)} 位市民")
            print(f"💬 訊息內文：\n{text}")
            print("="*50 + "\n")
            return True

        def multicast_flex(self, line_user_ids: list, alt_text: str, contents: dict, fallback_text: str = None) -> bool:
            """
            模擬 Flex 訊息群發。
            """
            print("\n" + "="*50)
            print("📡 [LINE Flex 群發攔截成功] 偵測到公告卡片推播（模擬器）！")
            print(f"👥 發送對象：實體資料庫內共 {len(line_user_ids)} 位市民")
            print(f"🪪 Alt Text：{alt_text}")
            print(f"🧱 Flex 內容：{contents}")
            if fallback_text:
                print(f"📝 文字備援：\n{fallback_text}")
            print("="*50 + "\n")
            return True

    # 實例化假物件，讓下方的路由代碼完全不用改動
    line_service = MockLineService()

bp = Blueprint('announcements', __name__, url_prefix='/api/announcements')


def _get_announcement_recipient_line_ids(cursor, target_city):
    if not target_city:
        cursor.execute(
            """
            SELECT line_user_id
            FROM users
            WHERE line_user_id IS NOT NULL
              AND status = 'active'
            """
        )
        return [row['line_user_id'] for row in cursor.fetchall() if row.get('line_user_id')]

    cursor.execute(
        """
        SELECT DISTINCT u.line_user_id
        FROM favorites f
        INNER JOIN users u ON u.user_id = f.user_id
        INNER JOIN stations s ON s.station_id = f.station_id
        INNER JOIN areas a ON a.areas_id = s.areas_id
        WHERE u.line_user_id IS NOT NULL
          AND u.status = 'active'
          AND a.city = %s
        """,
        (target_city,)
    )
    return [row['line_user_id'] for row in cursor.fetchall() if row.get('line_user_id')]


def _filter_valid_line_ids(line_ids):
    return [
        line_user_id
        for line_user_id in line_ids
        if line_user_id and re.match(r'^U[0-9a-fA-F]{32}$', line_user_id)
    ]


def _build_push_text(title: str, content: str, target_city: str = None) -> str:
    scope = f"{target_city}限定通報" if target_city else "系統公告"
    title_text = (title or '').strip()
    content_text = (content or '').strip()
    return f"📢【{scope}】\n\n【{title_text}】\n{content_text}\n\n— 垃圾車追蹤系統"


def _build_push_flex_contents(title: str, content: str, target_city: str = None) -> dict:
    title_text = (title or '').strip()
    content_text = (content or '').strip()
    scope_text = target_city if target_city else "全體縣市"
    time_text = datetime.now(ZoneInfo("Asia/Taipei")).strftime('%Y-%m-%d %H:%M')
    return {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#14A32C",
            "paddingAll": "6px",
            "contents": [
                {"type": "text", "text": "系統公告", "size": "sm", "weight": "bold", "color": "#FFFFFF"},
                {"type": "text", "text": f"適用範圍：{scope_text}", "size": "xs", "color": "#CCFBF1", "margin": "xs", "wrap": True},
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {"type": "text", "text": title_text, "size": "xl", "weight": "bold", "color": "#111827", "wrap": True},
                {"type": "separator", "margin": "md"},
                {"type": "text", "text": content_text, "size": "md", "color": "#374151", "wrap": True, "margin": "md", "lineSpacing": "4px"},
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {"type": "text", "text": f"發佈時間：{time_text}", "size": "xs", "color": "#6B7280"},
            ],
        },
    }


def _push_announcement_to_line(line_ids: list, title: str, content: str, target_city: str = None) -> bool:
    push_text = _build_push_text(title, content, target_city)
    flex_contents = _build_push_flex_contents(title, content, target_city)
    alt_text = f"【系統公告】{(title or '').strip()}"

    if hasattr(line_service, 'multicast_flex'):
        return line_service.multicast_flex(
            line_user_ids=line_ids,
            alt_text=alt_text,
            contents=flex_contents,
            fallback_text=push_text
        )
    return line_service.multicast_text(line_ids, push_text)

@bp.route('/push/<int:anno_id>', methods=['POST'])
@admin_required
def push_existing_announcement(anno_id):
    """專門幫已經存在資料庫、但尚未推播的公告進行補發 LINE 推播"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 1. 先去資料庫把這則公告的標題、內文、目標縣市撈出來
            find_sql = "SELECT title, content, target_city, is_pushed FROM announcements WHERE announcement_id = %s"
            cursor.execute(find_sql, [anno_id])
            anno = cursor.fetchone()
            
            if not anno:
                return jsonify({"status": "error", "message": "找不到該則公告"}), 404
                
            if anno.get('is_pushed') == 1:
                return jsonify({"status": "error", "message": "此公告先前已發送過推播，請勿重複發送"}), 400

            title = anno['title']
            content = anno['content']
            db_city = anno['target_city']

            # 2. 撈取所有要接收的 LINE 用戶
            line_ids = _filter_valid_line_ids(
                _get_announcement_recipient_line_ids(cursor, db_city)
            )

            if not line_ids:
                return jsonify({"status": "error", "message": "目前沒有符合此公告受眾的 LINE 訂閱用戶"}), 400

            # 3. 🚀 物理發射（Flex 卡片 + 文字備援）
            sent_ok = _push_announcement_to_line(line_ids, title, content, db_city)
            if not sent_ok:
                return jsonify({"status": "error", "message": "LINE 推播發送失敗，請稍後再試"}), 502
             
            # 5. 更新該公告的狀態為「已推播 (1)」並記錄時間
            update_sql = """
                UPDATE announcements
                SET is_pushed = 1, pushed_at = NOW()
                WHERE announcement_id = %s
            """
            cursor.execute(update_sql, (anno_id,))

            write_audit_log(
                'announcement_push',
                target_type='announcement',
                target_id=anno_id,
                details={'recipients_count': len(line_ids), 'target_city': db_city},
                cursor=cursor,
            )

            conn.commit()

        return jsonify({"status": "success", "message": "歷史公告已成功補發 LINE 推播！"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"補發失敗: {str(e)}"}), 500
    finally:
        conn.close()

#補上這個 如果存著沒推到line 可以編輯更改
@bp.route('/update/<int:anno_id>', methods=['POST'])
@admin_required
def update_announcement(anno_id):
    """專門處理未發布歷史公告的文字與受眾修改"""
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    content = data.get('content')
    target_city = data.get('target_city')

    if not title or not content:
        return jsonify({"status": "error", "message": "請填寫公告主題與詳細內文"}), 400

    # 資料庫 Enum 校正：全體 -> NULL
    db_city = None if target_city == '全體' else target_city

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 🟢 安全機制：先檢查這則公告是不是真的「還沒推播」
            check_sql = "SELECT is_pushed FROM announcements WHERE announcement_id = %s"
            cursor.execute(check_sql, [anno_id])
            anno = cursor.fetchone()
            
            if not anno:
                return jsonify({"status": "error", "message": "找不到該則公告"}), 404
                
            if anno.get('is_pushed') == 1:
                return jsonify({"status": "error", "message": "此公告已發送 LINE 推播，為了避免市民收到的內容與後台不符，禁止修改！"}), 400

            # 🟢 真正執行資料庫 UPDATE
            update_sql = """
                UPDATE announcements
                SET title = %s, content = %s, target_city = %s
                WHERE announcement_id = %s
            """
            cursor.execute(update_sql, (title, content, db_city, anno_id))

            write_audit_log(
                'announcement_update',
                target_type='announcement',
                target_id=anno_id,
                details={'title': title, 'target_city': db_city},
                cursor=cursor,
            )

            conn.commit()

        return jsonify({"status": "success", "message": "公告修改已成功同步至資料庫！"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"資料庫更新失敗: {str(e)}"}), 500
    finally:
        conn.close()

# 1. 🔍 讀取歷史公告紀錄
@bp.route('/list', methods=['GET'])
def get_announcements_list():
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 使用 DATE_FORMAT 將時間格式化為前端 React 最友善的字串格式
            sql = """
                SELECT announcement_id, title, content, target_city, is_pushed, 
                       DATE_FORMAT(pushed_at, '%Y-%m-%d %H:%i') as pushed_at, 
                       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at 
                FROM announcements 
                ORDER BY announcement_id DESC
            """
            cursor.execute(sql)
            data = cursor.fetchall()
        return jsonify({"announcements": data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"資料庫讀取失敗: {str(e)}"}), 500
    finally:
        conn.close()

# 2. 🚀 發布新公告（含一鍵群發 LINE Bot 核心邏輯）
@bp.route('/template/<int:announcement_id>', methods=['GET'])
@admin_required
def get_announcement_template(announcement_id):
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """
                SELECT announcement_id, title, content, target_city, is_pushed, pushed_at, created_at
                FROM announcements
                WHERE announcement_id = %s
                """,
                (announcement_id,)
            )
            announcement = cursor.fetchone()

        if not announcement:
            return jsonify({"status": "error", "message": "找不到該則公告"}), 404

        return jsonify({"status": "success", "announcement": announcement}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": f"公告模板讀取失敗: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/create', methods=['POST'])
@admin_required
def create_announcement():
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    content = data.get('content')
    target_city = data.get('target_city')
    trigger_push = data.get('trigger_push', 0) 
    created_by = data.get('created_by')

    if not title or not content:
        return jsonify({"status": "error", "message": "請填寫公告主題與詳細內文"}), 400

    db_city = None if target_city == '全體' else target_city

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # A. 將公告本體寫入 MySQL 存檔
            insert_sql = """
                INSERT INTO announcements (title, content, target_city, is_pushed, created_by) 
                VALUES (%s, %s, %s, 0, %s)
            """
            cursor.execute(insert_sql, (title, content, db_city, created_by))
            new_anno_id = cursor.lastrowid

            write_audit_log(
                'announcement_create',
                target_type='announcement',
                target_id=new_anno_id,
                details={
                    'title': title,
                    'target_city': db_city,
                    'triggered_push': bool(trigger_push),
                },
                cursor=cursor,
            )

            # 🟢 修正點一：先 Commit 公告本體 + audit，確保它絕對會留在資料庫
            conn.commit()
            
            # B. ⚡ 一鍵推播特權
            if trigger_push == 1:
                # 🟢 修正點二：用獨立的 try-except 罩住 LINE 引擎，就算它爆炸，API 依然算成功
                try:
                    line_ids = _filter_valid_line_ids(
                        _get_announcement_recipient_line_ids(cursor, db_city)
                    )

                    if line_ids:
                        sent_ok = _push_announcement_to_line(line_ids, title, content, db_city)
                        if sent_ok:
                            # 更新這條公告的推播歷史狀態
                            update_sql = """
                                UPDATE announcements 
                                SET is_pushed = 1, pushed_at = NOW() 
                                WHERE announcement_id = %s
                            """
                            cursor.execute(update_sql, (new_anno_id,))
                            conn.commit() # 更新成功才 commit 狀態
                        else:
                            print("⚠️ [LINE 推播失敗] 發送回傳 False，公告僅存檔未標記已推播")
                    else:
                        print("⚠️ [LINE 推播略過] 沒有符合公告受眾條件的有效 LINE 用戶")
                        
                except Exception as line_err:
                    # LINE 功能有任何閃失，只在後端印出警告，不連累前方的公告存檔
                    print(f"⚠️ [LINE 推播失敗] 功能未完成或發生錯誤: {line_err}")

        return jsonify({"status": "success", "message": "公告成功發布並完成存檔紀錄"}), 201

    except Exception as e:
        # 這裡只有在「一開始連 A 存檔都失敗」時才會觸發 rollback
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端發布失敗: {str(e)}"}), 500
    finally:
        conn.close()
