-- Reconcile generated-code assignment fields that are present in the Prisma
-- schema and application services but were missing from migration history.
-- Each assignment object is added only when absent because some deployed
-- databases already received these schema changes outside migration history.
ALTER TABLE `generated_codes`
    MODIFY `status` ENUM('AVAILABLE', 'ASSIGNED', 'USED', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE';

SET @wallet_has_assigned_satellite_id = (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'generated_codes'
      AND `COLUMN_NAME` = 'assigned_satellite_id'
);
SET @wallet_add_assigned_satellite_id = IF(
    @wallet_has_assigned_satellite_id = 0,
    'ALTER TABLE `generated_codes` ADD COLUMN `assigned_satellite_id` CHAR(36) NULL',
    'SELECT 1'
);
PREPARE wallet_reconcile_statement FROM @wallet_add_assigned_satellite_id;
EXECUTE wallet_reconcile_statement;
DEALLOCATE PREPARE wallet_reconcile_statement;

SET @wallet_has_assigned_at = (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'generated_codes'
      AND `COLUMN_NAME` = 'assigned_at'
);
SET @wallet_add_assigned_at = IF(
    @wallet_has_assigned_at = 0,
    'ALTER TABLE `generated_codes` ADD COLUMN `assigned_at` DATETIME(3) NULL',
    'SELECT 1'
);
PREPARE wallet_reconcile_statement FROM @wallet_add_assigned_at;
EXECUTE wallet_reconcile_statement;
DEALLOCATE PREPARE wallet_reconcile_statement;

SET @wallet_has_assigned_satellite_index = (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`STATISTICS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'generated_codes'
      AND `INDEX_NAME` = 'generated_codes_assigned_satellite_id_idx'
);
SET @wallet_add_assigned_satellite_index = IF(
    @wallet_has_assigned_satellite_index = 0,
    'CREATE INDEX `generated_codes_assigned_satellite_id_idx` ON `generated_codes`(`assigned_satellite_id`)',
    'SELECT 1'
);
PREPARE wallet_reconcile_statement FROM @wallet_add_assigned_satellite_index;
EXECUTE wallet_reconcile_statement;
DEALLOCATE PREPARE wallet_reconcile_statement;

SET @wallet_has_status_assigned_index = (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`STATISTICS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'generated_codes'
      AND `INDEX_NAME` = 'generated_codes_status_assigned_satellite_id_idx'
);
SET @wallet_add_status_assigned_index = IF(
    @wallet_has_status_assigned_index = 0,
    'CREATE INDEX `generated_codes_status_assigned_satellite_id_idx` ON `generated_codes`(`status`, `assigned_satellite_id`)',
    'SELECT 1'
);
PREPARE wallet_reconcile_statement FROM @wallet_add_status_assigned_index;
EXECUTE wallet_reconcile_statement;
DEALLOCATE PREPARE wallet_reconcile_statement;

SET @wallet_has_assigned_satellite_foreign_key = (
    SELECT COUNT(*)
    FROM `INFORMATION_SCHEMA`.`REFERENTIAL_CONSTRAINTS`
    WHERE `CONSTRAINT_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'generated_codes'
      AND `CONSTRAINT_NAME` = 'generated_codes_assigned_satellite_id_fkey'
);
SET @wallet_add_assigned_satellite_foreign_key = IF(
    @wallet_has_assigned_satellite_foreign_key = 0,
    'ALTER TABLE `generated_codes` ADD CONSTRAINT `generated_codes_assigned_satellite_id_fkey` FOREIGN KEY (`assigned_satellite_id`) REFERENCES `satellites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
);
PREPARE wallet_reconcile_statement FROM @wallet_add_assigned_satellite_foreign_key;
EXECUTE wallet_reconcile_statement;
DEALLOCATE PREPARE wallet_reconcile_statement;

-- Wallet funding is kept separate from member earnings so opening credits and
-- top-ups never affect earnings rankings.
CREATE TABLE `wallet_transactions` (
    `id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `type` ENUM('OPENING_CREDIT', 'TOP_UP', 'WITHDRAWAL', 'ADJUSTMENT') NOT NULL,
    `direction` ENUM('CREDIT', 'DEBIT', 'NEUTRAL') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
    `amount` DECIMAL(14, 2) NOT NULL,
    `source_key` VARCHAR(191) NOT NULL,
    `generated_code_id` CHAR(36) NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallet_transactions_source_key_key`(`source_key`),
    UNIQUE INDEX `wallet_transactions_generated_code_id_key`(`generated_code_id`),
    INDEX `wallet_transactions_member_id_status_created_at_idx`(`member_id`, `status`, `created_at`),
    INDEX `wallet_transactions_member_id_type_created_at_idx`(`member_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `wallet_transactions`
    ADD CONSTRAINT `wallet_transactions_member_id_fkey`
    FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `wallet_transactions`
    ADD CONSTRAINT `wallet_transactions_generated_code_id_fkey`
    FOREIGN KEY (`generated_code_id`) REFERENCES `generated_codes`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
