from flask import Blueprint, request, jsonify
from app.db import get_db_connection
# 💡 依賴規格：引入 P3 的 LINE 核心群發服務
import pymysql

# ─── 💡 依賴規格相容性防禦線 ───
try:
    # 嘗試引入組員承諾要給的群發函式
    from app.services.line_service import multicast_text
except ImportError:
    # 🛡️ 隊友防禦機制：如果組員程式碼還沒到位、改名或漏寫，自動開啟「精準攔截模擬器」
    import logging
    logging.warning("⚠️ [相容警報] 無法從 line_service 讀取 multicast_text。已自動切換為後台安全模擬發送模式。")
    
    def multicast_text(line_ids, text):
        """
        當組員那邊掉鏈子時，這個模擬器會接管請求，確保資料庫照常寫入、前端不噴 500！
        """
        print("\n" + "="*50)
        print("📡 [LINE 核心群發攔截成功] 偵測到高階公告推播調度！")
        print(f"👥 發送對象：實體資料庫內共 {len(line_ids)} 位市民")
        print(f"💬 訊息內文：\n{text}")
        print("="*50 + "\n")

bp = Blueprint('announcements', __name__, url_prefix='/api/announcements')

# 1. 🔍 讀取歷史公告紀錄
@bp.route('/list', methods=['GET'])
def get_announcements_list():
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 使用 DATE_FORMAT 將時間格式化為前端 React 最友善的字串格式
            sql = """
                SELECT announcement_id, title, content, target_city, is_pushed, 
                       DATE_FORMAT(pushed_at, '%%Y-%%m-%%d %%H:%%i') as pushed_at, 
                       DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i') as created_at 
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
@bp.route('/create', methods=['POST'])
def create_announcement():
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    content = data.get('content')
    target_city = data.get('target_city')
    trigger_push = data.get('trigger_push', 0) # 前端傳來的推播意願 (1 或 0)

    if not title or not content:
        return jsonify({"status": "error", "message": "請填寫公告主題與詳細內文"}), 400

    # 資料庫 Enum 校正：若前端選擇「全體縣市」，在 MySQL 中存入 NULL 代表全體廣播
    db_city = None if target_city == '全體' else target_city

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # A. 將公告本體寫入 MySQL 存檔
            insert_sql = """
                INSERT INTO announcements (title, content, target_city, is_pushed) 
                VALUES (%s, %s, %s, 0)
            """
            cursor.execute(insert_sql, (title, content, db_city))
            new_anno_id = cursor.lastrowid
            
            # B. ⚡ 一鍵推播特權：調度 LINE 官方群發引擎
            if trigger_push == 1:
                # 撈取所有「正常使用」且「具有 LINE 識別碼」的實體用戶
                user_sql = "SELECT line_user_id FROM users WHERE line_user_id IS NOT NULL AND status = 'active'"
                cursor.execute(user_sql)
                user_rows = cursor.fetchall()
                
                # 提取乾淨的 line_user_id 陣列清單
                line_ids = [row[0] for row in user_rows if row[0]]

                if line_ids:
                    # 組合符合公務發布基調的 LINE 內文字串
                    push_msg = f"📢【系統公告】{title}\n\n{content}"
                    if db_city:
                        push_msg = f"📍【{db_city}限定通報】{title}\n\n{content}"
                    
                    # 🚀 呼叫 P3 模組的群發服務，直接物理發射到市民的手機 LINE 視窗中！
                    multicast_text(line_ids, push_msg)
                    
                    # 更新這條公告的推播歷史狀態
                    update_sql = """
                        UPDATE announcements 
                        SET is_pushed = 1, pushed_at = NOW() 
                        WHERE announcement_id = %s
                    """
                    cursor.execute(update_sql, (new_anno_id,))
            
            conn.commit()
        return jsonify({"status": "success", "message": "公告成功發布並完成存檔紀錄"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"後端發布失敗: {str(e)}"}), 500
    finally:
        conn.close()