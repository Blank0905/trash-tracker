-- 管理者操作紀錄表
-- 用於記錄敏感 / 高權限 / 不可逆的管理操作（升降權、停權、公告推播、ETL、刪除等）
-- 設計原則：append-only、與業務表解耦（不設 FK，避免 admin 帳號被刪時連動刪 log）
-- actor_email 冗餘保存，避免日後查詢時 admin email 改了找不到對應人

CREATE TABLE IF NOT EXISTS admin_audit_log (
    log_id        BIGINT       NOT NULL AUTO_INCREMENT,
    actor_user_id INT          NOT NULL                 COMMENT '操作者 user_id（不設 FK，僅作參考）',
    actor_email   VARCHAR(255) DEFAULT NULL             COMMENT '操作者當下的 email（冗餘保存）',
    action        VARCHAR(50)  NOT NULL                 COMMENT '動作識別：user_promote / user_suspend / announcement_push / etl_run...',
    target_type   VARCHAR(50)  DEFAULT NULL             COMMENT '對象類別：user / announcement / route / station / etl_source',
    target_id     INT          DEFAULT NULL             COMMENT '對象 ID（依 target_type 對應）',
    details       JSON         DEFAULT NULL             COMMENT '補充內容（前後值、payload、收件人數等）',
    ip_address    VARCHAR(45)  DEFAULT NULL             COMMENT '來源 IP（支援 IPv6）',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (log_id),
    INDEX idx_actor   (actor_user_id),
    INDEX idx_action  (action),
    INDEX idx_target  (target_type, target_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='管理者操作審計紀錄（append-only）';
