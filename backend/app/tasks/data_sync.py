import logging
import uuid
from datetime import datetime
from typing import Dict, List

from app.db import get_db_connection
# 透過 app/tasks/newimport.py 的橋接（importlib 動態載入 database/newimport.py），
# 繞過 database/ 非 package、不在 sys.path 的問題。
from app.tasks.newimport import run_import

logger = logging.getLogger(__name__)

VALID_SOURCES = {"TPE", "NTPC", "KLU"}
VALID_PHASES = {"download", "import"}
VALID_STATUSES = {"success", "failed", "partial"}


def _format_dt(value: object) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _normalize_result(result: Dict[str, object]) -> Dict[str, object]:
    source = str(result.get("source") or "TPE")
    phase = str(result.get("phase") or "import")
    status = str(result.get("status") or "failed")

    if source not in VALID_SOURCES:
        source = "TPE"
    if phase not in VALID_PHASES:
        phase = "import"
    if status not in VALID_STATUSES:
        status = "failed"

    return {
        "source": source,
        "phase": phase,
        "status": status,
        "records_affected": result.get("records_affected"),
        "message": result.get("message"),
        "started_at": _format_dt(result.get("started_at")),
        "finished_at": _format_dt(result.get("finished_at")),
    }


def _insert_sync_logs(run_id: str, phase_results: List[Dict[str, object]]) -> None:
    conn = get_db_connection()
    if not conn:
        logger.error("無法建立資料庫連線，寫入 api_sync_log 失敗")
        return

    try:
        normalized = [_normalize_result(item) for item in phase_results]
        if not normalized:
            logger.warning("本次同步無可寫入的 api_sync_log 紀錄，run_id=%s", run_id)
            return

        sql = """
            INSERT INTO api_sync_log
                (run_id, source, phase, status, records_affected, message, started_at, finished_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        rows = [
            (
                run_id,
                item["source"],
                item["phase"],
                item["status"],
                item["records_affected"],
                item["message"],
                item["started_at"],
                item["finished_at"],
            )
            for item in normalized
        ]

        with conn.cursor() as cursor:
            cursor.executemany(sql, rows)
        conn.commit()
        logger.info("同步日誌已寫入 api_sync_log，run_id=%s，筆數=%d", run_id, len(rows))
    except Exception as db_err:
        logger.error("寫入 api_sync_log 失敗，run_id=%s，錯誤=%s", run_id, str(db_err))
    finally:
        conn.close()


def execute_daily_data_sync():
    """每週日凌晨 02:00 執行的定時同步排程（亦供 admin 後台手動觸發）。"""
    run_id = str(uuid.uuid4())
    logger.info("觸發每週資料同步任務，run_id=%s", run_id)

    phase_results: List[Dict[str, object]] = []
    try:
        # run_import 會回傳逐城市、逐階段（download/import）的結果清單
        phase_results = run_import()
    except Exception as error:
        now = datetime.now()
        logger.error("run_import 發生未預期異常，run_id=%s，錯誤=%s", run_id, str(error))
        phase_results = [
            {
                "source": "TPE",
                "phase": "import",
                "status": "failed",
                "records_affected": None,
                "message": f"run_import 未預期異常：{error}",
                "started_at": now,
                "finished_at": datetime.now(),
            }
        ]

    _insert_sync_logs(run_id, phase_results)
