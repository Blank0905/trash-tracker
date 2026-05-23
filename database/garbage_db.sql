-- phpMyAdmin SQL Dump
-- version 5.2.1
-- [phpmyadmin.net](https://www.phpmyadmin.net/)
--
-- 主機： 127.0.0.1
-- 產生時間： 2026-05-10 17:49:48
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
-- 資料表結構 `areas`
--

CREATE TABLE `areas` (
  `areas_id`  int(11)                          NOT NULL AUTO_INCREMENT,
  `city`      enum('台北市','新北市','基隆市') NOT NULL,
  `district`  varchar(20)                      DEFAULT NULL,
  `village`   varchar(50)                      DEFAULT NULL,
  PRIMARY KEY (`areas_id`),
  UNIQUE KEY  `uk_city_district_village` (`city`, `district`, `village`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `bag_regulations`
--

CREATE TABLE `bag_regulations` (
  `reg_id`             int(11)                  NOT NULL AUTO_INCREMENT,
  `city`               enum('台北市','新北市')  NOT NULL,
  `bag_size`           varchar(20)              NOT NULL,
  `volume_liters`      decimal(5,1)             DEFAULT NULL,
  `price`              decimal(5,2)             DEFAULT NULL,
  `purchase_locations` text                     DEFAULT NULL,
  `notes`              text                     DEFAULT NULL,
  PRIMARY KEY (`reg_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `favorites`
--

CREATE TABLE `favorites` (
  `fav_id`     int(11)      NOT NULL AUTO_INCREMENT,
  `user_id`    int(11)      NOT NULL,
  `station_id` int(11)      NOT NULL,
  `alias`      varchar(100) DEFAULT NULL,
  `created_at` timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`fav_id`),
  UNIQUE KEY `uk_user_station` (`user_id`, `station_id`),
  KEY `station_id` (`station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `notifications`
--

CREATE TABLE `notifications` (
  `noti_id`            int(11)                        NOT NULL AUTO_INCREMENT,
  `user_id`            int(11)                        NOT NULL,
  `station_id`         int(11)                        NOT NULL,
  `remind_before_mins` int(11)                        DEFAULT 10,
  `notify_garbage`     tinyint(1)                     DEFAULT 1,
  `notify_recycling`   tinyint(1)                     DEFAULT 1,
  `notify_foodscraps`  tinyint(1)                     DEFAULT 1,
  `is_active`          tinyint(1)                     DEFAULT 1,
  `device_token`       varchar(255)                   DEFAULT NULL,
  `push_method`        enum('web','line','email')      DEFAULT 'web',
  `created_at`         timestamp                      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`noti_id`),
  KEY `user_id` (`user_id`),
  KEY `station_id` (`station_id`),
  KEY `idx_active` (`is_active`, `station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 資料表結構 `routes`
-- 移除：city, district（改由 areas_id 取代）
--

CREATE TABLE `routes` (
  `route_id`    int(11)      NOT NULL AUTO_INCREMENT,
  `areas_id`    int(11)      NOT NULL,
  `route_code`  varchar(50)  DEFAULT NULL,
  `route_name`  varchar(100) NOT NULL,
  `car_number`  varchar(20)  DEFAULT NULL,
  `team`        varchar(50)  DEFAULT NULL,
  `trip_number` varchar(20)  DEFAULT NULL,
  PRIMARY KEY (`route_id`),
  KEY `idx_areas`      (`areas_id`),
  KEY `idx_route_code` (`route_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=13561;

-- --------------------------------------------------------

--
-- 資料表結構 `stations`
-- 移除：city, district, village（改由 areas_id 取代）
--

CREATE TABLE `stations` (
  `station_id`     int(11)       NOT NULL AUTO_INCREMENT,
  `route_id`       int(11)       NOT NULL,
  `areas_id`       int(11)       NOT NULL,
  `station_name`   varchar(200)  NOT NULL,
  `sequence_order` int(11)       DEFAULT NULL,
  `longitude`      decimal(10,7) DEFAULT NULL,
  `latitude`       decimal(10,7) DEFAULT NULL,
  `arrive_time`    time          DEFAULT NULL,
  `leave_time`     time          DEFAULT NULL,
  `stay_type`      varchar(20)   DEFAULT NULL,
  `memo`           text          DEFAULT NULL,
  `raw_source_id`  varchar(50)   DEFAULT NULL,
  PRIMARY KEY (`station_id`),
  KEY `route_id`        (`route_id`),
  KEY `idx_areas`       (`areas_id`),
  KEY `idx_arrive_time` (`arrive_time`),
  KEY `idx_coords`      (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=175474;

-- --------------------------------------------------------

--
-- 資料表結構 `station_schedules`
--

CREATE TABLE `station_schedules` (
  `schedule_id`        int(11)    NOT NULL AUTO_INCREMENT,
  `station_id`         int(11)    NOT NULL,
  `day_of_week`        tinyint(4) NOT NULL COMMENT '0=日, 1=一, 2=二, 3=三, 4=四, 5=五, 6=六',
  `collects_garbage`   tinyint(1) DEFAULT 0,
  `collects_recycling` tinyint(1) DEFAULT 0,
  `collects_foodscraps`tinyint(1) DEFAULT 0,
  PRIMARY KEY (`schedule_id`),
  UNIQUE KEY `uk_station_day` (`station_id`, `day_of_week`),
  KEY `idx_day` (`day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=746921;

-- --------------------------------------------------------

--
-- 資料表結構 `users`
--

CREATE TABLE `users` (
  `user_id`       int(11)                          NOT NULL AUTO_INCREMENT,
  `line_user_id`  varchar(50)                      DEFAULT NULL,
  `username`      varchar(50)                      NOT NULL,
  `email`         varchar(100)                     DEFAULT NULL,
  `password_hash` varchar(255)                     NOT NULL,
  `role`          enum('user','developer','admin')  DEFAULT 'user',
  `created_at`    timestamp                        NOT NULL DEFAULT current_timestamp(),
  `updated_at`    timestamp                        NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username`        (`username`),
  UNIQUE KEY `email`           (`email`),
  UNIQUE KEY `uk_line_user_id` (`line_user_id`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- 外鍵限制式
--

ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`user_id`)    REFERENCES `users`    (`user_id`)    ON DELETE CASCADE,
  ADD CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`)    REFERENCES `users`    (`user_id`)    ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

ALTER TABLE `routes`
  ADD CONSTRAINT `routes_ibfk_1` FOREIGN KEY (`areas_id`) REFERENCES `areas` (`areas_id`) ON DELETE RESTRICT;

ALTER TABLE `stations`
  ADD CONSTRAINT `stations_ibfk_1` FOREIGN KEY (`route_id`)  REFERENCES `routes` (`route_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stations_ibfk_2` FOREIGN KEY (`areas_id`)  REFERENCES `areas`  (`areas_id`) ON DELETE RESTRICT;

ALTER TABLE `station_schedules`
  ADD CONSTRAINT `station_schedules_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`station_id`) ON DELETE CASCADE;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
