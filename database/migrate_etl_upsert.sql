-- ================================================================
-- ETL 冪等支援：為 routes / stations 加 biz_key + UNIQUE index
-- ----------------------------------------------------------------
-- 跑這個 SQL 後，database/newimport.py 的 _insert_route 與
-- _insert_station 會走 ON DUPLICATE KEY UPDATE 路徑 → ETL 不再疊加。
--
-- 前置條件：先用 wipe_etl_data.sql 清乾淨歷次累積的重複資料，
-- 否則 ALTER ADD UNIQUE 會因現有重複而失敗（duplicate entry）。
--
-- 設計重點：
--  - 用 VIRTUAL（非 STORED）generated column：ADD 是 in-place，
--    不會 rebuild 整個 stations 表，避免撞 1215 FK constraint
--    （stations 是 favorites/notifications/station_schedules 的 FK parent）
--  - SET FOREIGN_KEY_CHECKS = 0 雙保險
--  - idempotent：開頭條件式 DROP 既有殘留，可重複執行
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ====== 條件式 DROP（清前一次失敗或舊版本的殘留） ======

-- routes: uk_routes_biz index
SET @s := (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE routes DROP INDEX uk_routes_biz',
        'DO 0')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND INDEX_NAME = 'uk_routes_biz'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- routes: biz_key column
SET @s := (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE routes DROP COLUMN biz_key',
        'DO 0')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'biz_key'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- stations: uk_stations_biz index
SET @s := (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE stations DROP INDEX uk_stations_biz',
        'DO 0')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stations' AND INDEX_NAME = 'uk_stations_biz'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- stations: biz_key column
SET @s := (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE stations DROP COLUMN biz_key',
        'DO 0')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stations' AND COLUMN_NAME = 'biz_key'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ====== 加 biz_key column + UNIQUE index ======

-- ============== routes ==============
-- 業務 key = (areas_id, route_code, route_name, car_number, team, trip_number)
-- 用 VIRTUAL generated column（in-place ADD，省空間，UNIQUE 仍可建）
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
    ) VIRTUAL;

ALTER TABLE routes
  ADD UNIQUE INDEX uk_routes_biz (biz_key);

-- ============== stations ==============
-- 業務 key = (route_id, station_name, ROUND(lat,5), ROUND(lng,5))
-- ----------------------------------------------------------------
-- ⚠️ 為何要包含 route_id：現有 schema 是「每個 station 屬於一條 route」，
--    同一個物理站若被 N 條路線經過會產生 N 筆 row（這是 schema 的設計）。
--    若 biz_key 不含 route_id，這些 N 筆會被當「重複」撞 UNIQUE 失敗。
--    包含 route_id 後：同條路線同站才視為同筆，跨路線各自獨立。
--    前端 search 已用 station_name 做視覺去重，不影響顯示體驗。
-- ROUND 5 位約 1.1m，容忍同來源資料多次匯入時座標的浮點微差
-- ⚠️ 用 VIRTUAL（非 STORED）：stations 是多個表的 FK parent，
--    STORED ADD 會 rebuild 表並撞 1215；VIRTUAL ADD 是 in-place 不會
ALTER TABLE stations
  ADD COLUMN biz_key VARCHAR(512)
    GENERATED ALWAYS AS (
      CONCAT_WS('|',
        CAST(route_id AS CHAR),
        COALESCE(station_name, ''),
        COALESCE(CAST(ROUND(latitude,  5) AS CHAR), ''),
        COALESCE(CAST(ROUND(longitude, 5) AS CHAR), '')
      )
    ) VIRTUAL;

ALTER TABLE stations
  ADD UNIQUE INDEX uk_stations_biz (biz_key);

SET FOREIGN_KEY_CHECKS = 1;

-- 確認 index 已建立
SHOW INDEX FROM routes   WHERE Key_name = 'uk_routes_biz';
SHOW INDEX FROM stations WHERE Key_name = 'uk_stations_biz';
