-- CreateTable
CREATE TABLE `members` (
    `id` CHAR(36) NOT NULL,
    `membership_id` VARCHAR(30) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(30) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `membership_type` ENUM('BASIC') NOT NULL DEFAULT 'BASIC',
    `status` ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
    `referral_code` VARCHAR(20) NOT NULL,
    `activation_code_hash` CHAR(64) NULL,
    `activation_expires_at` DATETIME(3) NULL,
    `sponsor_id` CHAR(36) NULL,
    `root_marker` VARCHAR(10) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `members_membership_id_key`(`membership_id`),
    UNIQUE INDEX `members_email_key`(`email`),
    UNIQUE INDEX `members_username_key`(`username`),
    UNIQUE INDEX `members_referral_code_key`(`referral_code`),
    UNIQUE INDEX `members_activation_code_hash_key`(`activation_code_hash`),
    UNIQUE INDEX `members_root_marker_key`(`root_marker`),
    INDEX `members_sponsor_id_idx`(`sponsor_id`),
    INDEX `members_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_sponsor_id_fkey` FOREIGN KEY (`sponsor_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
