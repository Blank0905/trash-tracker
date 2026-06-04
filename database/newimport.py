import math
import os
import re
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd
import pymysql


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

    def _insert_route(
        self,
        areas_id: int,
        route_code: str = None,
        route_name: str = None,
        car_number: str = None,
        team: str = None,
        trip_number: str = None,
    ) -> int:
        sql = """
            INSERT INTO routes (areas_id, route_code, route_name, car_number, team, trip_number)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        self.cursor.execute(
            sql,
            (
                self._clean(areas_id),
                self._clean(route_code),
                self._clean(route_name),
                self._clean(car_number),
                self._clean(team),
                self._clean(trip_number),
            ),
        )
        self._commit_if_needed()
        return self.cursor.lastrowid

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
        sql = """
            INSERT INTO stations
            (route_id, areas_id, station_name, sequence_order,
             longitude, latitude, arrive_time, leave_time, stay_type, memo, raw_source_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        self.cursor.execute(
            sql,
            (
                self._clean(route_id),
                self._clean(areas_id),
                self._clean(station_name),
                self._clean(sequence_order),
                self._clean(longitude),
                self._clean(latitude),
                self._clean(arrive_time),
                self._clean(leave_time),
                self._clean(stay_type),
                self._clean(memo),
                self._clean(raw_source_id),
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
        for day in [2, 4, 6]:
            self._insert_schedule(station_id, day, True, True, True)
        for day in [1, 3, 5]:
            self._insert_schedule(station_id, day, True, False, False)

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

    def import_taipei(self, csv_path: Path) -> None:
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
                    longitude=self._safe_float(row["經度"]),
                    latitude=self._safe_float(row["緯度"]),
                    arrive_time=self._parse_time_4digit(row["抵達時間"]),
                    leave_time=self._parse_time_4digit(row["離開時間"]),
                )
                self._insert_taipei_schedule(station_id)

        self.conn.commit()
        print("台北市匯入完成")

    def import_new_taipei(self, csv_path: Path) -> None:
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
                    longitude=self._safe_float(row["longitude"]),
                    latitude=self._safe_float(row["latitude"]),
                    arrive_time=self._parse_time_hhmm(row["time"]),
                    memo=row.get("memo"),
                )
                self._insert_new_taipei_schedule(station_id, row)

        self.conn.commit()
        print("新北市匯入完成")

    def import_keelung(self, csv_path: Path) -> None:
        print(f"開始匯入 基隆市 檔案={csv_path}")
        df = self._read_csv(csv_path)
        self._validate_columns(
            df,
            ["編號", "清運路線名稱", "班別", "清運點", "順序", "經度", "緯度", "預估到達時間", "預估離開時間"],
            "基隆市資料",
        )

        route_groups = df.groupby(["編號", "清運路線名稱", "班別"])
        for route_code, route_name, team in route_groups.groups.keys():
            group = route_groups.get_group((route_code, route_name, team))
            district = self._extract_keelung_district(route_name)
            route_area_id = self._get_or_create_area("基隆市", district, None)
            route_id = self._insert_route(route_area_id, route_code, route_name, trip_number=team)

            for _, row in group.iterrows():
                station_name = self._clean_station_name(row["清運點"], "基隆市", district)
                station_area_id = self._get_or_create_area("基隆市", district, None)
                station_id = self._insert_station(
                    route_id=route_id,
                    areas_id=station_area_id,
                    station_name=station_name,
                    sequence_order=self._safe_int(row["順序"]),
                    longitude=self._safe_float(row["經度"]),
                    latitude=self._safe_float(row["緯度"]),
                    arrive_time=self._parse_time_hhmm(row["預估到達時間"]),
                    leave_time=self._parse_time_hhmm(row["預估離開時間"]),
                    stay_type=row.get("停留時間"),
                    raw_source_id=row.get("stopId"),
                )
                self._insert_keelung_schedule(station_id, row.get("回收日(星期幾)"))

        self.conn.commit()
        print("基隆市匯入完成")

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


def run_import() -> None:
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
        importer.import_taipei(resolve_csv_path("台北市垃圾車清運點位資訊.csv"))
        importer.import_new_taipei(resolve_csv_path("新北市垃圾車路線.csv"))
        importer.import_keelung(resolve_csv_path("route_klepb.csv"))
        importer.conn.commit()
        print("全部資料匯入完成")
    except pymysql.MySQLError as error:
        if importer:
            importer.conn.rollback()
        print(f"資料庫錯誤 {error}")
        raise
    except Exception as error:
        if importer:
            importer.conn.rollback()
        print(f"匯入失敗 {error}")
        raise
    finally:
        if importer:
            importer.close()
            print("資料庫連線已關閉")


if __name__ == "__main__":
    run_import()

