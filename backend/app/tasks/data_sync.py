import logging
from datetime import datetime
from app.db import get_db_connection
# 透過 app/tasks/newimport.py 的橋接（importlib 動態載入 database/newimport.py），
# 繞過 database/ 非 package、不在 sys.path 的問題。
from app.tasks.newimport import run_import

logger = logging.getLogger(__name__)

def execute_daily_data_sync():
    """
    每日凌晨 02:00 執行的定時同步排程
    """
    logger.info("觸發每日凌晨 02:00 資料同步任務...")

    started_at = datetime.now()
    status = "success"
    records_affected = None  # run_import 目前不回傳筆數，記 NULL
    error_message = None

    try:
        # 呼叫整併後的 newimport ETL（北北基三市一次匯入）
        run_import()
        logger.info("ETL 資料同步完成")

    except Exception as e:
        status = "failed"  # api_sync_log.status ENUM 僅允許 success/failed/partial
        error_message = str(e)
        logger.error(f"資料同步發生嚴重異常: {error_message}")

    finally:
        finished_at = datetime.now()

        # 寫入日誌到 api_sync_log 資料表供管理後台監控
        conn = get_db_connection()
        if not conn:
            logger.error("無法建立資料庫連線，寫入 api_sync_log 失敗")
            return

        try:
            with conn.cursor() as cursor:
                # ETL 一次匯入北北基三市，無法單一標源；source 暫記 'TPE'（schema ENUM 限定 TPE/NTPC/KLU）
                source_label = "TPE"

                sql = """
                    INSERT INTO api_sync_log
                        (source, status, records_affected, message, started_at, finished_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (
                    source_label,
                    status,
                    records_affected,
                    error_message,
                    started_at.strftime("%Y-%m-%d %H:%M:%S"),
                    finished_at.strftime("%Y-%m-%d %H:%M:%S")
                ))
                conn.commit()
                logger.info("同步日誌 (api_sync_log) 已成功寫入 MySQL。")
        except Exception as db_err:
            logger.error(f"寫入 api_sync_log 失敗: {str(db_err)}")
        finally:
            conn.close()
