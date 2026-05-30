import logging
from datetime import datetime
from app.db import get_db_connection

# 嘗試引入 database/newimport.py 封裝後的 ETL 主函式
try:
    from database.newimport import run_etl_import
except ImportError:
    # 防禦性宣告：若 newimport 尚未封裝完成時的備用骨架
    def run_etl_import():
        raise NotImplementedError("database.newimport 內的 run_etl_import 尚未實作完成！")

logger = logging.getLogger(__name__)

def execute_daily_data_sync():
    """
    每日凌晨 02:00 執行的定時同步排程
    """
    logger.info("⏰ 觸發每日凌晨 02:00 資料同步任務...")
    
    started_at = datetime.now()
    status = "success"
    records_affected = 0
    error_message = None

    try:
        # 呼叫你整併後的 newimport ETL 腳本，並回傳受影響的總筆數
        records_affected = run_etl_import()
        if records_affected is None:
            records_affected = 0
            
        logger.info(f"ETL 資料同步完成，影響筆數: {records_affected}")

    except Exception as e:
        status = "error"
        error_message = str(e)
        logger.error(f"❌ 資料同步發生嚴重異常: {error_message}")

    finally:
        finished_at = datetime.now()
        
        # 寫入日誌到 api_sync_log 資料表供 P4 後台看
        conn = get_db_connection()
        if not conn:
            logger.error("無法建立資料庫連線，寫入 api_sync_log 失敗")
            return

        try:
            with conn.cursor() as cursor:
                # source 依 schema 規範標註為數據源（例如：'TPE'）
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