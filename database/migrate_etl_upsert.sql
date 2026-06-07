-- ================================================================
-- ETL 冪等支援：為 routes / stations 加 biz_key + UNIQUE index
-- ----------------------------------------------------------------
-- 跑這個 SQL 後，database/newimport.py 的 _insert_route 與
-- _insert_station 會走 ON DUPLICATE KEY UPDATE 路徑 → ETL 不再疊加。
--
-- 前置條件：先用 wipe_etl_data.sql 清乾淨歷次累積的重複資料，
-- 否則 ALTER ADD UNIQUE 會因現有重複而失敗（duplicate entry）。
-- ================================================================

-- ============== routes ==============
-- 業務 key = (areas_id, route_code, route_name, car_number, team, trip_number)
-- 用 STORED 生成欄位把 6 個欄位合併（NULL → 空字串，避免 UNIQUE 對 NULL 失效）
ALTER TABLE routes
  ADD COLUMN biz_key VARCHAR(512)
    GENERATED ALWAYS AS (
      CONCAT_WS('|',
        CAST(areas_id AS CHAR),
        COALESCE(route_code,   ''),
        COALESCE(route_name,   ''),
        COALESCE(car_number,   ''),
        COALESCE(team,         ''),
        COALESCE(trip_number,  '')
      )
    ) STORED;

ALTER TABLE routes
  ADD UNIQUE INDEX uk_routes_biz (biz_key);

-- ============== stations ==============
-- 業務 key = (station_name, ROUND(lat,5), ROUND(lng,5))
-- ROUND 5 位約 1.1m，容忍同來源資料多次匯入時座標的浮點微差
ALTER TABLE stations
  ADD COLUMN biz_key VARCHAR(512)
    GENERATED ALWAYS AS (
      CONCAT_WS('|',
        COALESCE(station_name, ''),
        COALESCE(CAST(ROUND(latitude,  5) AS CHAR), ''),
        COALESCE(CAST(ROUND(longitude, 5) AS CHAR), '')
      )
    ) STORED;

ALTER TABLE stations
  ADD UNIQUE INDEX uk_stations_biz (biz_key);

-- 確認 index 已建立
SHOW INDEX FROM routes   WHERE Key_name = 'uk_routes_biz';
SHOW INDEX FROM stations WHERE Key_name = 'uk_stations_biz';
