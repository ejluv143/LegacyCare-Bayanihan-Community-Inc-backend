-- CreateTable
CREATE TABLE `satellite_announcement_reads` (
    `id` CHAR(36) NOT NULL,
    `announcement_id` CHAR(36) NOT NULL,
    `satellite_account_id` CHAR(36) NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `satellite_announcement_reads_announcement_id_satellite_acc_key`(`announcement_id`, `satellite_account_id`),
    INDEX `satellite_announcement_reads_satellite_account_id_idx`(`satellite_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `satellite_announcement_reads` ADD CONSTRAINT `satellite_announcement_reads_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_announcement_reads` ADD CONSTRAINT `satellite_announcement_reads_satellite_account_id_fkey` FOREIGN KEY (`satellite_account_id`) REFERENCES `satellite_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
