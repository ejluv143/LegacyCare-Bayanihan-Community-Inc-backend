-- CreateTable
CREATE TABLE `member_earnings` (
    `id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `type` ENUM('PAIRING_INCOME', 'REFERRAL_COMMISSION', 'GROUP_COMMISSION') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
    `amount` DECIMAL(14, 2) NOT NULL,
    `earned_at` DATETIME(3) NOT NULL,
    `source_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `member_earnings_source_key_key`(`source_key`),
    INDEX `member_earnings_status_earned_at_member_id_idx`(`status`, `earned_at`, `member_id`),
    INDEX `member_earnings_member_id_status_earned_at_idx`(`member_id`, `status`, `earned_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `member_earnings` ADD CONSTRAINT `member_earnings_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
