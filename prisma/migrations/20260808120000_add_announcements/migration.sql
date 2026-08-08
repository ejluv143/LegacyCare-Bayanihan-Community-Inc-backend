-- AlterTable
ALTER TABLE `members`
  MODIFY COLUMN `status` ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'DECEASED') NOT NULL DEFAULT 'PENDING_ACTIVATION';

-- CreateTable
CREATE TABLE `announcements` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('GENERAL', 'DEATH') NOT NULL DEFAULT 'GENERAL',
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `content` TEXT NOT NULL,
    `priority` ENUM('HIGH', 'NORMAL', 'INFO') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('SCHEDULED', 'PUBLISHED', 'EXPIRED') NOT NULL DEFAULT 'PUBLISHED',
    `posted_by` VARCHAR(191) NULL,
    `deceased_member_id` CHAR(36) NULL,
    `assessment_processed_at` DATETIME(3) NULL,
    `assessment_processed_by_admin_id` VARCHAR(191) NULL,
    `assessment_member_count` INTEGER NULL,
    `assessment_total_amount` DECIMAL(14, 2) NULL,
    `created_by_admin_id` VARCHAR(191) NULL,
    `publish_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `announcements_status_publish_at_idx`(`status`, `publish_at`),
    INDEX `announcements_type_idx`(`type`),
    INDEX `announcements_deceased_member_id_idx`(`deceased_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement_reads` (
    `id` CHAR(36) NOT NULL,
    `announcement_id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcement_reads_member_id_idx`(`member_id`),
    UNIQUE INDEX `announcement_reads_announcement_id_member_id_key`(`announcement_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_deceased_member_id_fkey` FOREIGN KEY (`deceased_member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
