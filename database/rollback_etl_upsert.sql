-- ================================================================
-- 回滾：清掉之前嘗試加進去的 routes / stations biz_key + UNIQUE
-- ----------------------------------------------------------------
-- 我們改成在 Python 端做冪等檢查（database/newimport.py 內 _find_existing_*
-- + INSERT），DB schema 不再需要 biz_key 與 UNIQUE。
--
-- 此 SQL 為 idempotent（用 information_schema + PREPARE 模擬條件式
-- DROP）：對「曾跑過 migration 的 DB」會清掉殘留；對「全新 DB」則
-- 全部 no-op，跑了也無傷。可重複執行。
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;

-- 確認都沒了（應該回傳空 result）
SHOW INDEX FROM routes   WHERE Key_name = 'uk_routes_biz';
SHOW INDEX FROM stations WHERE Key_name = 'uk_stations_biz';
