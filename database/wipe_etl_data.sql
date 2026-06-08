-- ================================================================
-- 一次性：清空 ETL 相關表 + favorites / notifications，準備重跑 ETL
-- ----------------------------------------------------------------
-- ⚠️ 開發階段才用！正式環境會破壞所有使用者收藏與通知設定。
-- 用途：歷次 ETL 累積的重複資料一次清乾淨；跑完此 SQL 後再執行一次
--       完整 ETL，DB 會回到「乾淨的一份資料」狀態。
-- 不清的表：admin_audit_log、bag_regulations、bulky_waste_info、
--           etl_sources、users、announcements、api_sync_log
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE station_schedules;
TRUNCATE TABLE notifications;
TRUNCATE TABLE favorites;
TRUNCATE TABLE stations;
TRUNCATE TABLE routes;
TRUNCATE TABLE areas;

SET FOREIGN_KEY_CHECKS = 1;

-- 確認結果（全部應為 0）
SELECT 'areas'             AS table_name, COUNT(*) AS row_count FROM areas
UNION ALL SELECT 'routes',             COUNT(*) FROM routes
UNION ALL SELECT 'stations',           COUNT(*) FROM stations
UNION ALL SELECT 'station_schedules',  COUNT(*) FROM station_schedules
UNION ALL SELECT 'favorites',          COUNT(*) FROM favorites
UNION ALL SELECT 'notifications',      COUNT(*) FROM notifications;
