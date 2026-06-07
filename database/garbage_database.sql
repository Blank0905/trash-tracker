-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- 主機： 127.0.0.1
-- 產生時間： 2026-06-02 10:20:13
-- 伺服器版本： 10.4.32-MariaDB
-- PHP 版本： 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 資料庫： `garbage_database`
--

-- --------------------------------------------------------

--
-- 資料表結構 `announcements`
--

CREATE TABLE `announcements` (
  `announcement_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL COMMENT '自由格式內文',
  `target_city` enum('台北市','新北市','基隆市') DEFAULT NULL COMMENT 'NULL = 全體',
  `created_by` int(11) DEFAULT NULL COMMENT '發布的管理員 user_id',
  `is_pushed` tinyint(1) DEFAULT 0 COMMENT '是否已透過 LINE 推播',
  `pushed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `api_sync_log`
--

CREATE TABLE `api_sync_log` (
  `log_id` int(11) NOT NULL,
  `run_id` char(36) NOT NULL COMMENT '同一次排程的關聯鍵(UUID)',
  `source` enum('TPE','NTPC','KLU') NOT NULL COMMENT '台北/新北/基隆',
  `phase` enum('download','import') NOT NULL COMMENT 'download=下載CSV, import=匯入DB',
  `status` enum('success','failed','partial') NOT NULL,
  `records_affected` int(11) DEFAULT NULL,
  `message` text DEFAULT NULL COMMENT '錯誤訊息或摘要',
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `areas`
--

CREATE TABLE `areas` (
  `areas_id` int(11) NOT NULL,
  `city` enum('台北市','新北市','基隆市') NOT NULL,
  `district` varchar(20) DEFAULT NULL,
  `village` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `bag_regulations`
--

CREATE TABLE `bag_regulations` (
  `reg_id` int(11) NOT NULL,
  `city` enum('台北市','新北市') NOT NULL,
  `category` enum('一般專用','環保兩用') NOT NULL DEFAULT '一般專用' COMMENT '產品線',
  `name` varchar(50) NOT NULL COMMENT '顯示名稱，如 14公升袋 / 零售版3公升袋(立體袋) / 環保兩用袋-中型',
  `volume_liters` decimal(5,1) DEFAULT NULL COMMENT '容量（公升）',
  `units_per_pack` int(11) DEFAULT NULL COMMENT '每包個數（20/10/5/1）',
  `price_per_pack` decimal(7,2) DEFAULT NULL COMMENT '每包售價',
  `unit_price` decimal(6,2) DEFAULT NULL COMMENT '單個單價（零售款用此）',
  `style` varchar(20) DEFAULT NULL COMMENT '式樣：提耳式/平口式/摺角提耳式',
  `purchase_locations` text DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `bulky_waste_info`
--

CREATE TABLE `bulky_waste_info` (
  `info_id` int(11) NOT NULL,
  `city` enum('台北市','新北市','基隆市') NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text DEFAULT NULL COMMENT '自由格式：純文字或 JSON',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `favorites`
--

CREATE TABLE `favorites` (
  `fav_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `alias` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `notifications`
--

CREATE TABLE `notifications` (
  `noti_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `remind_before_mins` int(11) DEFAULT 10,
  `is_active` tinyint(1) DEFAULT 1,
  `device_token` varchar(255) DEFAULT NULL,
  `push_method` enum('web','line','email') DEFAULT 'web',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `notify_d0` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週日通知',
  `notify_d1` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週一通知',
  `notify_d2` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週二通知',
  `notify_d3` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週三通知',
  `notify_d4` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週四通知',
  `notify_d5` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週五通知',
  `notify_d6` tinyint(1) NOT NULL DEFAULT 1 COMMENT '週六通知'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `routes`
--

CREATE TABLE `routes` (
  `route_id` int(11) NOT NULL,
  `areas_id` int(11) NOT NULL,
  `route_code` varchar(50) DEFAULT NULL,
  `route_name` varchar(100) NOT NULL,
  `car_number` varchar(20) DEFAULT NULL,
  `team` varchar(50) DEFAULT NULL,
  `trip_number` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `stations`
--

CREATE TABLE `stations` (
  `station_id` int(11) NOT NULL,
  `route_id` int(11) NOT NULL,
  `areas_id` int(11) NOT NULL,
  `station_name` varchar(200) NOT NULL,
  `sequence_order` int(11) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `arrive_time` time DEFAULT NULL,
  `leave_time` time DEFAULT NULL,
  `stay_type` varchar(20) DEFAULT NULL,
  `memo` text DEFAULT NULL,
  `raw_source_id` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `station_schedules`
--

CREATE TABLE `station_schedules` (
  `schedule_id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `day_of_week` tinyint(4) NOT NULL COMMENT '0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六',
  `collects_garbage` tinyint(1) DEFAULT 0,
  `collects_recycling` tinyint(1) DEFAULT 0,
  `collects_foodscraps` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `line_user_id` varchar(50) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` enum('user','developer','admin') DEFAULT 'user',
  `status` enum('active','suspended') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 已傾印資料表的索引
--

--
-- 資料表索引 `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`announcement_id`),
  ADD KEY `idx_target_city` (`target_city`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `created_by` (`created_by`);

--
-- 資料表索引 `api_sync_log`
--
ALTER TABLE `api_sync_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_run_id` (`run_id`),
  ADD KEY `idx_run_source_phase` (`run_id`,`source`,`phase`),
  ADD KEY `idx_source` (`source`),
  ADD KEY `idx_finished_at` (`finished_at`);

--
-- 資料表索引 `areas`
--
ALTER TABLE `areas`
  ADD PRIMARY KEY (`areas_id`),
  ADD UNIQUE KEY `uk_city_district_village` (`city`,`district`,`village`);

--
-- 資料表索引 `bag_regulations`
--
ALTER TABLE `bag_regulations`
  ADD PRIMARY KEY (`reg_id`);

--
-- 資料表索引 `bulky_waste_info`
--
ALTER TABLE `bulky_waste_info`
  ADD PRIMARY KEY (`info_id`),
  ADD KEY `idx_city` (`city`);

--
-- 資料表索引 `favorites`
--
ALTER TABLE `favorites`
  ADD PRIMARY KEY (`fav_id`),
  ADD UNIQUE KEY `uk_user_station` (`user_id`,`station_id`),
  ADD KEY `station_id` (`station_id`);

--
-- 資料表索引 `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`noti_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `station_id` (`station_id`),
  ADD KEY `idx_active` (`is_active`,`station_id`);

--
-- 資料表索引 `routes`
--
ALTER TABLE `routes`
  ADD PRIMARY KEY (`route_id`),
  ADD KEY `idx_areas` (`areas_id`),
  ADD KEY `idx_route_code` (`route_code`);

--
-- 資料表索引 `stations`
--
ALTER TABLE `stations`
  ADD PRIMARY KEY (`station_id`),
  ADD KEY `route_id` (`route_id`),
  ADD KEY `idx_areas` (`areas_id`),
  ADD KEY `idx_arrive_time` (`arrive_time`),
  ADD KEY `idx_coords` (`latitude`,`longitude`);

--
-- 資料表索引 `station_schedules`
--
ALTER TABLE `station_schedules`
  ADD PRIMARY KEY (`schedule_id`),
  ADD UNIQUE KEY `uk_station_day` (`station_id`,`day_of_week`),
  ADD KEY `idx_day` (`day_of_week`);

--
-- 資料表索引 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uk_line_user_id` (`line_user_id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_status` (`status`);

--
-- 在傾印的資料表使用自動遞增(AUTO_INCREMENT)
--

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `announcements`
--
ALTER TABLE `announcements`
  MODIFY `announcement_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `api_sync_log`
--
ALTER TABLE `api_sync_log`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `areas`
--
ALTER TABLE `areas`
  MODIFY `areas_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `bag_regulations`
--
ALTER TABLE `bag_regulations`
  MODIFY `reg_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `bulky_waste_info`
--
ALTER TABLE `bulky_waste_info`
  MODIFY `info_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `favorites`
--
ALTER TABLE `favorites`
  MODIFY `fav_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `notifications`
--
ALTER TABLE `notifications`
  MODIFY `noti_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `routes`
--
ALTER TABLE `routes`
  MODIFY `route_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `stations`
--
ALTER TABLE `stations`
  MODIFY `station_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `station_schedules`
--
ALTER TABLE `station_schedules`
  MODIFY `schedule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 使用資料表自動遞增(AUTO_INCREMENT) `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- 已傾印資料表的限制式
--

--
-- 資料表的限制式 `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- 資料表的限制式 `favorites`
--
ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

--
-- 資料表的限制式 `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

--
-- 資料表的限制式 `routes`
--
ALTER TABLE `routes`
  ADD CONSTRAINT `routes_ibfk_1` FOREIGN KEY (`areas_id`) REFERENCES `areas` (`areas_id`);

--
-- 資料表的限制式 `stations`
--
ALTER TABLE `stations`
  ADD CONSTRAINT `stations_ibfk_1` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stations_ibfk_2` FOREIGN KEY (`areas_id`) REFERENCES `areas` (`areas_id`);

--
-- 資料表的限制式 `station_schedules`
--
ALTER TABLE `station_schedules`
  ADD CONSTRAINT `station_schedules_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

-- --------------------------------------------------------

--
-- 資料表結構 `etl_sources`（ETL 各市 CSV 下載網址；三市固定，僅 url 可由後台修改）
--

CREATE TABLE `etl_sources` (
  `source` enum('TPE','NTPC','KLU') NOT NULL COMMENT '台北/新北/基隆',
  `url` varchar(500) NOT NULL COMMENT 'CSV 下載網址',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` varchar(100) DEFAULT NULL COMMENT '最後修改的管理員'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `etl_sources`
  ADD PRIMARY KEY (`source`);

INSERT INTO `etl_sources` (`source`, `url`) VALUES
('TPE', 'https://data.taipei/api/dataset/6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae/resource/a6e90031-7ec4-4089-afb5-361a4efe7202/download'),
('NTPC', 'https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/csv/file'),
('KLU', 'https://opendata-kl.askeycloud.com/route_klepb.csv');

-- --------------------------------------------------------

--
-- 資料表結構 `admin_audit_log`（管理者操作審計紀錄；append-only，不設 FK 與業務表解耦）
-- 寫入 helper：backend/app/utils/audit.py；列表 API：/api/admin/audit-log
--

CREATE TABLE `admin_audit_log` (
  `log_id` bigint(20) NOT NULL,
  `actor_user_id` int(11) NOT NULL COMMENT '操作者 user_id（不設 FK，僅作參考）',
  `actor_email` varchar(255) DEFAULT NULL COMMENT '操作者當下的 email（冗餘保存，避免日後改 email 找不到）',
  `action` varchar(50) NOT NULL COMMENT '動作識別：user_promote / user_suspend / announcement_push / etl_run...',
  `target_type` varchar(50) DEFAULT NULL COMMENT '對象類別：user / announcement / route / station / etl_source',
  `target_id` int(11) DEFAULT NULL COMMENT '對象 ID（依 target_type 對應）',
  `details` longtext DEFAULT NULL COMMENT '補充內容 JSON（前後值、payload、收件人數等）' CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL COMMENT '來源 IP（支援 IPv6）',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `admin_audit_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_actor` (`actor_user_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_target` (`target_type`,`target_id`),
  ADD KEY `idx_created` (`created_at`);

ALTER TABLE `admin_audit_log`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- 垃圾袋規範種子資料（台北市環保局、新北市環保局公告，2025）
--
INSERT INTO `bag_regulations`
  (`city`, `category`, `name`, `volume_liters`, `units_per_pack`, `price_per_pack`, `unit_price`, `style`, `purchase_locations`, `notes`) VALUES
-- 台北市（一般專用）
('台北市','一般專用','3公升袋',3.0,20,21,1.05,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','5公升袋',5.0,20,36,1.80,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','14公升袋',14.0,20,100,5.00,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','25公升袋',25.0,20,180,9.00,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','33公升袋',33.0,20,237,11.85,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','76公升袋',76.0,10,273,27.30,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','120公升袋',120.0,5,216,43.20,NULL,'便利商店、超市及指定販售處',NULL),
('台北市','一般專用','零售版3公升袋',3.0,1,1,1.00,NULL,'便利商店、超市及指定販售處','零售單顆販售'),
('台北市','一般專用','零售版3公升袋(立體袋)',3.0,1,1,1.00,NULL,'便利商店、超市及指定販售處','零售單顆、立體袋'),
('台北市','一般專用','零售版14公升袋',14.0,1,5,5.00,NULL,'便利商店、超市及指定販售處','零售單顆販售'),
-- 新北市（一般專用）
('新北市','一般專用','3公升袋',3.0,20,21,1.05,'提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬300-315×長420-441 mm'),
('新北市','一般專用','5公升袋',5.0,20,36,1.80,'提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬360-378×長450-473 mm'),
('新北市','一般專用','14公升袋',14.0,20,100,5.00,'提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬430-452×長615-646 mm'),
('新北市','一般專用','25公升袋',25.0,20,180,9.00,'提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬550-578×長750-788 mm'),
('新北市','一般專用','33公升袋',33.0,20,237,11.85,'平口式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬630-662×長720-756 mm'),
('新北市','一般專用','75公升袋',75.0,10,270,27.00,'平口式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬830-872×長900-945 mm'),
('新北市','一般專用','120公升袋',120.0,5,216,43.20,'平口式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','尺寸 寬940-987×長1100-1155 mm'),
-- 新北市（環保兩用袋，零售計價）
('新北市','環保兩用','環保兩用袋-小型',2.8,20,NULL,1.00,'摺角提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','環保兩用袋，零售 1 元/個'),
('新北市','環保兩用','環保兩用袋-中型',5.6,20,NULL,2.00,'摺角提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','環保兩用袋，零售 2 元/個'),
('新北市','環保兩用','環保兩用袋-大型',13.9,20,NULL,5.00,'摺角提耳式','連鎖超商、超市及貼有「專用垃圾袋銷售處」之專賣店','環保兩用袋，零售 5 元/個');

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
