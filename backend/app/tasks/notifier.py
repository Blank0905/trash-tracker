import logging
from datetime import datetime, timedelta
from app.db import get_db_connection
from app.services.line_service import line_service

logger = logging.getLogger(__name__)

# 記憶體去重組合：儲存 (noti_id, date_str)，避免 60 秒內重複推播
# 註：此為單程序簡易去重，符合現階段規格需求
notified_set = set()

def check_and_send_notifications():
    """
    每 60 秒執行的到站提醒主邏輯
    1. 撈出「今天這個星期有開通知」的設定（notify_d{今天}=1）
    2. 確認該站今天有收運（station_schedules）
    3. 判斷當前時間是否在到站前提醒區間內
    4. 呼叫 line_service 主動推播
    """
    logger.info("開始執行到站推播排程檢查...")

    now = datetime.now()
    current_date_str = now.strftime("%Y-%m-%d")

    # Python weekday(): 一=0, 二=1..., 日=6
    # 資料庫 schema day_of_week: 日=0, 一=1, 二=2..., 六=6
    python_weekday = now.weekday()
    db_day_of_week = (python_weekday + 1) % 7

    conn = get_db_connection()
    if not conn:
        logger.error("無法建立資料庫連線，跳過本次檢查")
        return

    try:
        # 連線池為 PyMySQL，cursorclass 已預設 DictCursor，回傳即字典
        with conn.cursor() as cursor:
            # 1. 撈出啟用中、且「今天這個星期」有開通知的設定（notify_d{db_day_of_week}=1）
            #    db_day_of_week 為自行計算的 0~6 整數，直接內插欄位名安全
            sql = f"""
                SELECT
                    n.noti_id, n.remind_before_mins, n.station_id,
                    s.station_name, s.arrive_time,
                    u.line_user_id
                FROM notifications n
                JOIN stations s ON n.station_id = s.station_id
                JOIN users u ON n.user_id = u.user_id
                WHERE n.is_active = 1 AND u.status = 'active'
                  AND n.notify_d{db_day_of_week} = 1
            """
            cursor.execute(sql)
            notifications = cursor.fetchall()

            for noti in notifications:
                noti_id = noti['noti_id']
                line_user_id = noti['line_user_id']

                # 去重檢查：如果今天已經通知過這筆設定，直接跳過
                if (noti_id, current_date_str) in notified_set:
                    continue

                # 2. 確認該站「今天」有收運，並取得收運種類供訊息顯示
                cursor.execute(
                    """
                    SELECT collects_garbage, collects_recycling, collects_foodscraps
                    FROM station_schedules
                    WHERE station_id = %s AND day_of_week = %s
                    """,
                    (noti['station_id'], db_day_of_week)
                )
                schedule = cursor.fetchone()
                if not schedule:
                    continue  # 今天這站沒排班，跳過

                collect_types = []
                if schedule['collects_garbage']: collect_types.append("一般垃圾")
                if schedule['collects_recycling']: collect_types.append("資源回收")
                if schedule['collects_foodscraps']: collect_types.append("廚餘")
                if not collect_types:
                    continue  # 今天這站沒收運，跳過

                # 3. 時間區間判斷 [arrive_time - remind_before_mins, arrive_time]
                arrive_time_str = str(noti['arrive_time'])  # 確保是字串 "HH:MM:SS"
                try:
                    arrive_dt = datetime.strptime(f"{current_date_str} {arrive_time_str}", "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    logger.warning(f"站點時間格式有誤: {arrive_time_str}，略過不處理。")
                    continue

                start_remind_dt = arrive_dt - timedelta(minutes=noti['remind_before_mins'])

                # 判斷「現在時間」有沒有落在這個提醒區間內
                if start_remind_dt <= now <= arrive_dt:
                    message = (
                        f"🔔 垃圾車到站提醒 🔔\n\n"
                        f"📍 站點：{noti['station_name']}\n"
                        f"⏰ 預計到站時間：{arrive_time_str[:5]}\n"
                        f"⏱️ 將於 {noti['remind_before_mins']} 分鐘內抵達！\n"
                        f"🚚 今日收運項目：{', '.join(collect_types)}\n\n"
                        f"請提早準備好出門喔！"
                    )

                    success = line_service.push_text(line_user_id, message)
                    if success:
                        logger.info(f"成功發送到站通知給 User LineID: {line_user_id} (Notification ID: {noti_id})")
                        notified_set.add((noti_id, current_date_str))
                    else:
                        logger.error(f"發送通知失敗給 User LineID: {line_user_id}")

    except Exception as e:
        logger.error(f"執行到站推播過程中發生異常: {str(e)}")
    finally:
        conn.close()

# 每日凌晨清理過期的 set，避免記憶體無限膨脹
def clear_expired_notified_set():
    global notified_set
    current_date_str = datetime.now().strftime("%Y-%m-%d")
    # 只保留當天的紀錄，以前的直接砍掉
    notified_set = {item for item in notified_set if item[1] == current_date_str}
    logger.info("已完成過期通知去重快取的清理。")
