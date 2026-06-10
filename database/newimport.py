import io
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import pymysql
import requests


# ── 開放資料來源：每次 ETL 前下載最新檔、安全覆蓋本地 CSV ──
# 直接寫死各市 data.gov.tw 對應的 CSV 下載網址（市府改 resource id 時需手動更新此處）。
SOURCES = [
    {
        "source": "TPE",
        "name": "台北市",
        "url": "https://data.taipei/api/dataset/6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae/resource/a6e90031-7ec4-4089-afb5-361a4efe7202/download",
        "filename": "台北市垃圾車清運點位資訊.csv",
        "encoding": "utf-8-sig",
        "required_columns": ["局編", "車次", "路線", "分隊", "車號", "行政區", "地點", "里別", "經度", "緯度", "抵達時間", "離開時間"],
    },
    {
        "source": "NTPC",
        "name": "新北市",
        "url": "https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/csv/file",
        "filename": "新北市垃圾車路線.csv",
        "encoding": "utf-8-sig",
        "required_columns": ["lineid", "linename", "city", "name", "rank", "longitude", "latitude", "time"],
    },
    {
        "source": "KLU",
        "name": "基隆市",
        "url": "https://opendata-kl.askeycloud.com/route_klepb.csv",
        "filename": "route_klepb.csv",
        "encoding": "utf-8-sig",  # 基隆來源實測為帶 BOM 的 UTF-8（data.gov.tw 標示的 Big5 已不符現況）
        "required_columns": ["編號", "清運路線名稱", "班別", "清運點", "順序", "經度", "緯度", "預估到達時間", "預估離開時間"],
    },
]


def _refresh_one(source: Dict[str, object], timeout: int = 30) -> int:
    """下載單一來源 → 驗證欄位 → 驗證通過才覆蓋本地檔（統一存成 UTF-8）。回傳資料筆數。"""
    resp = requests.get(
        source["url"],
        timeout=timeout,
        headers={"User-Agent": "Mozilla/5.0 (trash-tracker ETL)"},
    )
    resp.raise_for_status()

    # 依來源編碼解碼（基隆為 CP950），再以 dtype=str 讀進 DataFrame，與 ETL 讀法一致
    text = resp.content.decode(source["encoding"], errors="strict")
    df = pd.read_csv(io.StringIO(text), dtype=str)

    missing = [c for c in source["required_columns"] if c not in df.columns]
    if missing:
        raise ValueError(f"來源缺少欄位 {', '.join(missing)}")

    # 驗證通過才覆蓋；統一存 UTF-8（無 BOM），ETL 端維持以 UTF-8 讀取
    dest = Path(__file__).resolve().parent / source["filename"]
    df.to_csv(dest, index=False, encoding="utf-8")
    return len(df)


def _phase_result(
    source: str,
    phase: str,
    status: str,
    started_at: datetime,
    finished_at: datetime,
    records_affected: Optional[int] = None,
    message: Optional[str] = None,
) -> Dict[str, object]:
    return {
        "source": source,
        "phase": phase,
        "status": status,
        "records_affected": records_affected,
        "message": message,
        "started_at": started_at,
        "finished_at": finished_at,
    }


def _load_source_urls() -> Dict[str, str]:
    """從 etl_sources 表讀各市最新下載網址；連不到或表不存在則回空 dict（全部沿用程式預設）。"""
    config = load_db_config()
    try:
        conn = pymysql.connect(
            host=config["host"],
            port=config["port"],
            database=config["database"],
            user=config["user"],
            password=config["password"],
            charset="utf8mb4",
            connect_timeout=10,
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT source, url FROM etl_sources")
                return {row[0]: row[1] for row in cursor.fetchall() if row[1]}
        finally:
            conn.close()
    except Exception as error:
        print(f"[來源網址] 讀取 etl_sources 失敗，全部沿用程式預設網址（{error}）")
        return {}


def refresh_sources() -> List[Dict[str, object]]:
    """ETL 前置：下載三個開放資料來源並安全覆蓋本地 CSV。

    各來源獨立：某市下載或欄位驗證失敗時，保留該市既有本地檔、不影響其他市，
    讓本次 ETL 仍以該市舊資料繼續跑（不會因單一來源掛掉而整批失敗）。
    """
    print("=== 更新開放資料來源 ===")
    url_overrides = _load_source_urls()
    results: List[Dict[str, object]] = []
    for source in SOURCES:
        # 後台若設定過該市網址（etl_sources）則優先採用，否則沿用程式寫死的預設
        effective = dict(source)
        effective["url"] = url_overrides.get(source["source"], source["url"])
        started_at = datetime.now()
        try:
            count = _refresh_one(effective)
            print(f"[更新成功] {source['name']}：{count} 筆 → {source['filename']}")
            results.append(
                _phase_result(
                    source=source["source"],
                    phase="download",
                    status="success",
                    records_affected=count,
                    message=f"已更新 {source['filename']}",
                    started_at=started_at,
                    finished_at=datetime.now(),
                )
            )
        except Exception as error:
            print(f"[更新略過] {source['name']} 沿用既有本地檔（原因：{error}）")
            results.append(
                _phase_result(
                    source=source["source"],
                    phase="download",
                    status="failed",
                    records_affected=None,
                    message=f"下載失敗，沿用本地檔：{error}",
                    started_at=started_at,
                    finished_at=datetime.now(),
                )
            )
    return results


def load_db_config() -> Dict[str, object]:
    default = {
        "host": "localhost",
        "port": 3306,
        "database": "garbage_database",
        "user": "root",
        "password": "",
    }

    root_dir = Path(__file__).resolve().parents[1]
    env_path = root_dir / "backend" / ".env"
    try:
        from dotenv import load_dotenv

        load_dotenv(env_path)
    except Exception:
        pass

    merged = {
        "host": os.environ.get("DB_HOST", default["host"]),
        "port": os.environ.get("DB_PORT", default["port"]),
        "database": os.environ.get("DB_NAME", default["database"]),
        "user": os.environ.get("DB_USER", default["user"]),
        "password": os.environ.get("DB_PASSWORD", default["password"]),
    }

    try:
        merged["port"] = int(merged.get("port", 3306))
    except Exception:
        merged["port"] = 3306

    return merged


class GarbageTruckImporter:
    def __init__(
        self,
        host: str = "localhost",
        port: int = 3306,
        database: str = "garbage_database",
        user: str = "root",
        password: str = "",
        batch_size: int = 100,
    ) -> None:
        print(f"連線資料庫 host={host} port={port} database={database}")

        self.conn = pymysql.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            charset="utf8mb4",
            connect_timeout=60,
            read_timeout=600,
            write_timeout=600,
            autocommit=False,
        )
        self.cursor = self.conn.cursor()
        self.batch_size = batch_size
        self.batch_count = 0
        print("資料庫連線成功")

    def _commit_if_needed(self) -> None:
        self.batch_count += 1
        if self.batch_count % self.batch_size == 0:
            self.conn.commit()
            # 每 10000 筆才印一次進度，避免終端洗版（145k 筆從 ~1500 行壓到 ~15 行）
            if self.batch_count % (self.batch_size * 100) == 0:
                print(f"已提交資料 筆數={self.batch_count}")

    def _clean_station_name(self, name: str, city: str, district: str) -> str:
        if not name:
            return name

        name = str(name).strip()
        prefixes = []

        if city and district:
            prefixes.append(f"{city}{district}")
            if "台" in city:
                prefixes.append(f"{city.replace('台', '臺')}{district}")
            if "臺" in city:
                prefixes.append(f"{city.replace('臺', '台')}{district}")

        if city:
            prefixes.append(city)
            if "台" in city:
                prefixes.append(city.replace("台", "臺"))
            if "臺" in city:
                prefixes.append(city.replace("臺", "台"))

        if district:
            prefixes.append(district)

        prefixes.sort(key=len, reverse=True)
        for prefix in prefixes:
            if name.startswith(prefix):
                return name[len(prefix) :].strip()
        return name

    def _clean(self, val):
        if val is None:
            return None
        if isinstance(val, float) and math.isnan(val):
            return None
        text = str(val).strip()
        if text == "" or text.lower() == "nan":
            return None
        return val

    def _safe_float(self, val) -> Optional[float]:
        try:
            cleaned = self._clean(val)
            if cleaned is None:
                return None
            result = float(cleaned)
            return None if math.isnan(result) else result
        except Exception:
            return None

    def _safe_coord(self, val, lo: float, hi: float) -> Optional[float]:
        """經緯度防呆：解析失敗或超出台灣合理範圍（經度 119~123、緯度 21~26）就存 NULL 並記 log。
        避免單一壞點（如少小數點、TWD97 投影值）在 STRICT 模式下用 1264 讓整批匯入失敗。"""
        f = self._safe_float(val)
        if f is None:
            return None
        if f < lo or f > hi:
            print(f"[座標異常] 值 {f} 超出範圍 [{lo}, {hi}]，該點座標存 NULL")
            return None
        return f

    def _safe_int(self, val) -> Optional[int]:
        try:
            cleaned = self._clean(val)
            if cleaned is None:
                return None
            return int(float(cleaned))
        except Exception:
            return None

    def _parse_time_4digit(self, value) -> Optional[str]:
        cleaned = self._clean(value)
        if cleaned is None:
            return None
        text = str(cleaned).strip()
        if len(text) == 4 and text.isdigit():
            return f"{text[:2]}:{text[2:]}:00"
        if len(text) == 3 and text.isdigit():
            return f"0{text[0]}:{text[1:]}:00"
        return None

    def _parse_time_hhmm(self, value) -> Optional[str]:
        cleaned = self._clean(value)
        if cleaned is None:
            return None
        text = str(cleaned).strip()
        if ":" not in text:
            return None
        parts = text.split(":")
        if len(parts) < 2:
            return None
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"

    def _get_or_create_area(self, city: str, district: str = None, village: str = None) -> int:
        sql_select = """
            SELECT areas_id FROM areas
            WHERE city = %s
              AND (district <=> %s)
              AND (village <=> %s)
        """
        city_clean = self._clean(city)
        district_clean = self._clean(district)
        village_clean = self._clean(village)

        self.cursor.execute(sql_select, (city_clean, district_clean, village_clean))
        row = self.cursor.fetchone()
        if row:
            return row[0]

        sql_insert = """
            INSERT INTO areas (city, district, village)
            VALUES (%s, %s, %s)
        """
        self.cursor.execute(sql_insert, (city_clean, district_clean, village_clean))
        self._commit_if_needed()
        return self.cursor.lastrowid

    def _find_existing_route(
        self,
        areas_id: int,
        route_code: Optional[str],
        route_name: Optional[str],
        car_number: Optional[str],
        team: Optional[str],
        trip_number: Optional[str],
    ) -> Optional[int]:
        """依業務 key 查現有 route_id；找不到回 None。
        <=> 是 NULL-safe 等於：NULL 與 NULL 視為相等，避免 NULL 欄位失效。
        用獨立 cursor 避免與 INSERT cursor 共用造成的狀態 quirk。
        """
        sql = """
            SELECT route_id FROM routes
            WHERE areas_id = %s
              AND route_code  <=> %s
              AND route_name  <=> %s
              AND car_number  <=> %s
              AND team        <=> %s
              AND trip_number <=> %s
            LIMIT 1
        """
        with self.conn.cursor() as cursor:
            cursor.execute(sql, (areas_id, route_code, route_name, car_number, team, trip_number))
            row = cursor.fetchone()
        return row[0] if row else None

    def _insert_route(
        self,
        areas_id: int,
        route_code: str = None,
        route_name: str = None,
        car_number: str = None,
        team: str = None,
        trip_number: str = None,
    ) -> int:
        # 冪等：先查業務 key 是否已存在；存在就回現有 id（不重複 INSERT）
        cleaned = (
            self._clean(areas_id),
            self._clean(route_code),
            self._clean(route_name),
            self._clean(car_number),
            self._clean(team),
            self._clean(trip_number),
        )
        existing = self._find_existing_route(*cleaned)
        if existing is not None:
            return existing

        sql = """
            INSERT INTO routes (areas_id, route_code, route_name, car_number, team, trip_number)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        self.cursor.execute(sql, cleaned)
        self._commit_if_needed()
        return self.cursor.lastrowid

    def _find_existing_station(
        self,
        route_id: Optional[int],
        station_name: Optional[str],
        latitude: Optional[float],
        longitude: Optional[float],
        arrive_time: Optional[str],
        leave_time: Optional[str],
        sequence_order: Optional[int],
    ) -> Optional[int]:
        """依業務 key 查現有 station_id；找不到回 None。

        biz_key = (route_id, station_name, arrive_time)。
        - 為何把 arrive_time 納入 key：同站一天有多個到站時間時，每個時段視為獨立
          station_id，使用者才能分別收藏／設通知。若只用 (route_id, station_name)
          會把第二班合併掉，arrive_time 直接遺失。
        - 為何不納入 lat/lng/leave_time/sequence_order：實測中這些欄位有 float
          IEEE754 漂移、time parse 些微差異等問題，會讓本來該命中的 row 找不到。
          arrive_time 是 TIME 型別、語意明確，比對穩定。
        - publisher 微調 arrive_time（例：07:30 → 07:35）導致此處查不到時，由
          _insert_station 走 fallback：若同 (route_id, station_name) 只有一筆既有
          row，視為「改時間」，UPDATE 既有 row 而非 INSERT 新 row，避免孤兒累積。
        - ORDER BY station_id ASC LIMIT 1 確保多次跑都回相同（最早的）id，favorites
          收藏的 station_id 穩定。
        - 用獨立 cursor 避免與 self.cursor 共用狀態。
        """
        sql = """
            SELECT station_id FROM stations
            WHERE route_id = %s
              AND station_name <=> %s
              AND arrive_time <=> %s
            ORDER BY station_id ASC
            LIMIT 1
        """
        with self.conn.cursor() as cursor:
            cursor.execute(sql, (route_id, station_name, arrive_time))
            row = cursor.fetchone()
        return row[0] if row else None

    def _find_siblings_by_route_name(
        self,
        route_id: Optional[int],
        station_name: Optional[str],
    ) -> List[int]:
        """同 (route_id, station_name) 的所有 station_id，不限 arrive_time。

        用途：_insert_station 在完整 key 查不到時，靠這個判斷是「publisher 改了時間」
        （只有 1 筆 → UPDATE）還是「真的多了一個班次」（>1 筆 → INSERT 新 row）。
        用獨立 cursor 避免與 self.cursor 共用狀態。
        """
        sql = """
            SELECT station_id FROM stations
            WHERE route_id = %s AND station_name <=> %s
            ORDER BY station_id ASC
        """
        with self.conn.cursor() as cursor:
            cursor.execute(sql, (route_id, station_name))
            return [row[0] for row in cursor.fetchall()]

    def _update_station_times(
        self,
        station_id: int,
        arrive_time: Optional[str],
        leave_time: Optional[str],
    ) -> None:
        """publisher 修改 arrive_time 時，更新既有 row 而非建新 row，避免孤兒累積。"""
        sql = """
            UPDATE stations
            SET arrive_time = %s, leave_time = %s
            WHERE station_id = %s
        """
        self.cursor.execute(sql, (arrive_time, leave_time, station_id))
        self._commit_if_needed()

    def _insert_station(
        self,
        route_id: int,
        areas_id: int,
        station_name: str = None,
        sequence_order: int = None,
        longitude: float = None,
        latitude: float = None,
        arrive_time: str = None,
        leave_time: str = None,
        stay_type: str = None,
        memo: str = None,
        raw_source_id: str = None,
    ) -> int:
        # 冪等：business key = (route_id, station_name, arrive_time)
        # - 完整 key 命中 → 回既有 id
        # - 完整 key 沒命中、但同 (route_id, station_name) 已有恰好 1 筆 → 視為 publisher
        #   改時間，UPDATE 該筆並回其 id，避免孤兒 station_id 累積
        # - 其餘情況（同名 >1 筆，或完全沒同名）→ INSERT 新 row
        cleaned_route_id       = self._clean(route_id)
        cleaned_areas_id       = self._clean(areas_id)
        cleaned_station_name   = self._clean(station_name)
        cleaned_sequence_order = self._clean(sequence_order)
        cleaned_longitude      = self._clean(longitude)
        cleaned_latitude       = self._clean(latitude)
        cleaned_arrive_time    = self._clean(arrive_time)
        cleaned_leave_time     = self._clean(leave_time)
        cleaned_stay_type      = self._clean(stay_type)
        cleaned_memo           = self._clean(memo)
        cleaned_raw_source_id  = self._clean(raw_source_id)

        existing = self._find_existing_station(
            cleaned_route_id,
            cleaned_station_name,
            cleaned_latitude,
            cleaned_longitude,
            cleaned_arrive_time,
            cleaned_leave_time,
            cleaned_sequence_order,
        )
        if existing is not None:
            return existing

        # Fallback：完整 key 沒命中，判斷是「改時間」還是「新班次」
        siblings = self._find_siblings_by_route_name(cleaned_route_id, cleaned_station_name)
        if len(siblings) == 1:
            self._update_station_times(
                siblings[0],
                arrive_time=cleaned_arrive_time,
                leave_time=cleaned_leave_time,
            )
            return siblings[0]

        sql = """
            INSERT INTO stations
            (route_id, areas_id, station_name, sequence_order,
             longitude, latitude, arrive_time, leave_time, stay_type, memo, raw_source_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        self.cursor.execute(
            sql,
            (
                cleaned_route_id,
                cleaned_areas_id,
                cleaned_station_name,
                cleaned_sequence_order,
                cleaned_longitude,
                cleaned_latitude,
                cleaned_arrive_time,
                cleaned_leave_time,
                cleaned_stay_type,
                cleaned_memo,
                cleaned_raw_source_id,
            ),
        )
        self._commit_if_needed()
        return self.cursor.lastrowid

    def _insert_schedule(
        self, station_id: int, day: int, garbage: bool, recycling: bool, foodscraps: bool
    ) -> None:
        sql = """
            INSERT INTO station_schedules
            (station_id, day_of_week, collects_garbage, collects_recycling, collects_foodscraps)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                collects_garbage = VALUES(collects_garbage),
                collects_recycling = VALUES(collects_recycling),
                collects_foodscraps = VALUES(collects_foodscraps)
        """
        self.cursor.execute(sql, (station_id, day, garbage, recycling, foodscraps))
        self._commit_if_needed()

    def _insert_taipei_schedule(self, station_id: int) -> None:
        # 台北市：週一、二、四、五、六收運一般垃圾、資源回收、廚餘；週三、週日全市停收
        for day in [1, 2, 4, 5, 6]:
            self._insert_schedule(station_id, day, True, True, True)

    def _insert_new_taipei_schedule(self, station_id: int, row) -> None:
        days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        for day_idx, day_name in enumerate(days):
            garbage = row.get(f"garbage{day_name}", "") == "Y"
            recycling = row.get(f"recycling{day_name}", "") == "Y"
            foodscraps = row.get(f"foodscraps{day_name}", "") == "Y"
            if garbage or recycling or foodscraps:
                self._insert_schedule(station_id, day_idx, garbage, recycling, foodscraps)

    def _extract_keelung_district(self, route_name: str) -> str:
        match = re.search(r"(暖暖區|中正區|信義區|仁愛區|中山區|安樂區|七堵區)", route_name)
        return match.group(1) if match else "基隆市"

    def _insert_keelung_schedule(self, station_id: int, recycle_days_str: str) -> None:
        cleaned = self._clean(recycle_days_str)
        if cleaned is None:
            return

        day_mapping = {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "日": 0, "0": 0}
        for day_str in str(cleaned).split(","):
            day = day_mapping.get(day_str.strip())
            if day is not None:
                self._insert_schedule(station_id, day, True, True, True)

    @staticmethod
    def _read_csv(csv_path: Path) -> pd.DataFrame:
        df = pd.read_csv(csv_path, dtype=str)
        return df.replace({np.nan: None})

    @staticmethod
    def _validate_columns(df: pd.DataFrame, required_columns, source_name: str) -> None:
        missing = [column for column in required_columns if column not in df.columns]
        if missing:
            raise ValueError(f"{source_name} 缺少欄位 {', '.join(missing)}")

    def import_taipei(self, csv_path: Path) -> int:
        print(f"開始匯入 台北市 檔案={csv_path}")
        df = self._read_csv(csv_path)
        self._validate_columns(
            df,
            ["局編", "車次", "路線", "分隊", "車號", "行政區", "地點", "里別", "經度", "緯度", "抵達時間", "離開時間"],
            "台北市資料",
        )

        route_groups = df.groupby(["局編", "車次", "路線", "分隊", "車號", "行政區"])
        for route_code, trip, route_name, team, car_num, district in route_groups.groups.keys():
            group = route_groups.get_group((route_code, trip, route_name, team, car_num, district))
            route_area_id = self._get_or_create_area("台北市", district, None)
            route_id = self._insert_route(route_area_id, route_code, route_name, car_num, team, trip)

            for _, row in group.iterrows():
                station_name = self._clean_station_name(row["地點"], "台北市", row["行政區"])
                station_area_id = self._get_or_create_area("台北市", row["行政區"], row["里別"])
                station_id = self._insert_station(
                    route_id=route_id,
                    areas_id=station_area_id,
                    station_name=station_name,
                    longitude=self._safe_coord(row["經度"], 119, 123),
                    latitude=self._safe_coord(row["緯度"], 21, 26),
                    arrive_time=self._parse_time_4digit(row["抵達時間"]),
                    leave_time=self._parse_time_4digit(row["離開時間"]),
                )
                self._insert_taipei_schedule(station_id)

        self.conn.commit()
        print("台北市匯入完成")
        return len(df)

    def import_new_taipei(self, csv_path: Path) -> int:
        print(f"開始匯入 新北市 檔案={csv_path}")
        df = self._read_csv(csv_path)
        self._validate_columns(
            df,
            ["lineid", "linename", "city", "name", "rank", "longitude", "latitude", "time"],
            "新北市資料",
        )

        route_groups = df.groupby(["lineid", "linename", "city"])
        for line_id, line_name, district in route_groups.groups.keys():
            group = route_groups.get_group((line_id, line_name, district))
            route_area_id = self._get_or_create_area("新北市", district, None)
            route_id = self._insert_route(route_area_id, line_id, line_name)

            for _, row in group.iterrows():
                station_name = self._clean_station_name(row["name"], "新北市", row["city"])
                station_area_id = self._get_or_create_area("新北市", row["city"], row.get("village"))
                station_id = self._insert_station(
                    route_id=route_id,
                    areas_id=station_area_id,
                    station_name=station_name,
                    sequence_order=self._safe_int(row["rank"]),
                    longitude=self._safe_coord(row["longitude"], 119, 123),
                    latitude=self._safe_coord(row["latitude"], 21, 26),
                    arrive_time=self._parse_time_hhmm(row["time"]),
                    memo=row.get("memo"),
                )
                self._insert_new_taipei_schedule(station_id, row)

        self.conn.commit()
        print("新北市匯入完成")
        return len(df)

    def import_keelung(self, csv_path: Path) -> int:
        print(f"開始匯入 基隆市 檔案={csv_path}")
        df = self._read_csv(csv_path)
        self._validate_columns(
            df,
            ["編號", "清運路線名稱", "班別", "清運點", "順序", "經度", "緯度", "預估到達時間", "預估離開時間"],
            "基隆市資料",
        )

        # 一條清運路線 = (清運路線名稱, 班別)。
        # 「編號」其實是全表流水號（逐清運點遞增），不可當分組鍵，
        # 否則每個點都會各自變成一條路線；站點順序改用「順序」欄位。
        route_groups = df.groupby(["清運路線名稱", "班別"])
        for route_name, team in route_groups.groups.keys():
            group = route_groups.get_group((route_name, team))
            district = self._extract_keelung_district(route_name)
            route_area_id = self._get_or_create_area("基隆市", district, None)
            # route_code 取路線名稱開頭代碼（如「1-1」），取不到則 None
            code_match = re.match(r"^\s*(\d+-\d+)", str(route_name))
            route_code = code_match.group(1) if code_match else None
            route_id = self._insert_route(route_area_id, route_code, route_name, trip_number=team)

            for _, row in group.iterrows():
                station_name = self._clean_station_name(row["清運點"], "基隆市", district)
                station_area_id = self._get_or_create_area("基隆市", district, None)
                station_id = self._insert_station(
                    route_id=route_id,
                    areas_id=station_area_id,
                    station_name=station_name,
                    sequence_order=self._safe_int(row["順序"]),
                    longitude=self._safe_coord(row["經度"], 119, 123),
                    latitude=self._safe_coord(row["緯度"], 21, 26),
                    arrive_time=self._parse_time_hhmm(row["預估到達時間"]),
                    leave_time=self._parse_time_hhmm(row["預估離開時間"]),
                    stay_type=row.get("停留時間"),
                    raw_source_id=row.get("stopId"),
                )
                self._insert_keelung_schedule(station_id, row.get("回收日(星期幾)"))

        self.conn.commit()
        print("基隆市匯入完成")
        return len(df)

    def close(self) -> None:
        self.cursor.close()
        self.conn.close()

def resolve_csv_path(filename: str) -> Path:
    candidates = [
        Path.cwd() / filename,
        Path(__file__).resolve().parent / filename,
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(f"找不到資料檔案 {filename}")


def _import_one_city(importer: GarbageTruckImporter, source_code: str) -> int:
    if source_code == "TPE":
        return importer.import_taipei(resolve_csv_path("台北市垃圾車清運點位資訊.csv"))
    if source_code == "NTPC":
        return importer.import_new_taipei(resolve_csv_path("新北市垃圾車路線.csv"))
    if source_code == "KLU":
        return importer.import_keelung(resolve_csv_path("route_klepb.csv"))
    raise ValueError(f"不支援的來源代碼：{source_code}")


def run_import() -> List[Dict[str, object]]:
    results = refresh_sources()
    config = load_db_config()
    importer = None
    try:
        importer = GarbageTruckImporter(
            host=config["host"],
            port=config["port"],
            database=config["database"],
            user=config["user"],
            password=config["password"],
        )

        for source in SOURCES:
            started_at = datetime.now()
            try:
                count = _import_one_city(importer, source["source"])
                results.append(
                    _phase_result(
                        source=source["source"],
                        phase="import",
                        status="success",
                        records_affected=count,
                        message=f"匯入完成：{source['filename']}",
                        started_at=started_at,
                        finished_at=datetime.now(),
                    )
                )
            except Exception as error:
                importer.conn.rollback()
                print(f"[匯入失敗] {source['name']}：{error}")
                results.append(
                    _phase_result(
                        source=source["source"],
                        phase="import",
                        status="failed",
                        records_affected=None,
                        message=str(error),
                        started_at=started_at,
                        finished_at=datetime.now(),
                    )
                )

        print("全部資料匯入流程結束")
    except pymysql.MySQLError as error:
        print(f"資料庫連線錯誤 {error}")
        started_at = datetime.now()
        for source in SOURCES:
            results.append(
                _phase_result(
                    source=source["source"],
                    phase="import",
                    status="failed",
                    records_affected=None,
                    message=f"資料庫連線失敗：{error}",
                    started_at=started_at,
                    finished_at=datetime.now(),
                )
            )
    except Exception as error:
        print(f"匯入流程錯誤 {error}")
        started_at = datetime.now()
        for source in SOURCES:
            results.append(
                _phase_result(
                    source=source["source"],
                    phase="import",
                    status="failed",
                    records_affected=None,
                    message=f"匯入初始化失敗：{error}",
                    started_at=started_at,
                    finished_at=datetime.now(),
                )
            )
    finally:
        if importer:
            importer.close()
            print("資料庫連線已關閉")
    return results


if __name__ == "__main__":
    run_import()

