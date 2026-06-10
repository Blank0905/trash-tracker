-- ================================================================
-- 修正台北市收運班表（station_schedules）
-- ----------------------------------------------------------------
-- 背景：舊版 ETL 的 _insert_taipei_schedule 班表錯誤
--   錯誤：週三仍收一般垃圾、週五只收一般垃圾。
-- 正確（台北市清潔隊）：
--   週一、二、四、五、六 → 一般垃圾＋資源回收＋廚餘 三項全收
--   週三、週日           → 全市停收
-- day_of_week 對齊：0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六
--
-- 本檔只重建台北市站點的班表，不動 stations / routes / areas，
-- 也不動 favorites / notifications（收藏與通知設定保留）。
-- 純由程式推導的班表，毋須重跑整套 ETL。
--
-- ⚠️ 為何用 HEX(a.city) 而非 a.city = '台北市'：
--   經 docker 容器內 mysql client 以 -e / stdin 匯入時，中文字面（'台北市'）
--   會因 character_set_client 不一致而比對失準（實測整支空跑、0 筆命中）。
--   改以位元組比對 HEX(a.city) = 'E58FB0E58C97E5B882'（'台北市' 的 UTF-8 編碼），
--   完全不含中文字面，不受 client/terminal 編碼影響，必定命中。
-- ================================================================

-- 1) 刪除台北市所有既有班表
DELETE ss
FROM station_schedules ss
JOIN stations s ON ss.station_id = s.station_id
JOIN areas    a ON s.areas_id   = a.areas_id
WHERE HEX(a.city) = 'E58FB0E58C97E5B882';

-- 2) 重建：週一、二、四、五、六，三項全收
INSERT INTO station_schedules
    (station_id, day_of_week, collects_garbage, collects_recycling, collects_foodscraps)
SELECT s.station_id, d.day_of_week, 1, 1, 1
FROM stations s
JOIN areas a ON s.areas_id = a.areas_id
JOIN (
    SELECT 1 AS day_of_week
    UNION ALL SELECT 2
    UNION ALL SELECT 4
    UNION ALL SELECT 5
    UNION ALL SELECT 6
) d
WHERE HEX(a.city) = 'E58FB0E58C97E5B882';

-- 3) 確認結果：應只剩 day_of_week ∈ {1,2,4,5,6}，且三欄皆為 1
SELECT ss.day_of_week,
       COUNT(*)                       AS rows_count,
       SUM(ss.collects_garbage)       AS garbage,
       SUM(ss.collects_recycling)     AS recycling,
       SUM(ss.collects_foodscraps)    AS foodscraps
FROM station_schedules ss
JOIN stations s ON ss.station_id = s.station_id
JOIN areas    a ON s.areas_id   = a.areas_id
WHERE HEX(a.city) = 'E58FB0E58C97E5B882'
GROUP BY ss.day_of_week
ORDER BY ss.day_of_week;
