-- AlterTable
ALTER TABLE `members` MODIFY `membership_type` ENUM('BASIC', 'PREMIUM') NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE `generated_code_batches` (
    `id` CHAR(36) NOT NULL,
    `category` ENUM('ACTIVATION', 'TOP_UP', 'BENEFICIARY') NOT NULL,
    `activation_type` ENUM('BASIC', 'PREMIUM') NULL,
    `top_up_amount` INTEGER UNSIGNED NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generated_by_admin_id` VARCHAR(191) NULL,
    `generated_by_admin_name` VARCHAR(191) NULL,

    INDEX `generated_code_batches_category_idx`(`category`),
    INDEX `generated_code_batches_generated_at_idx`(`generated_at`),
    INDEX `generated_code_batches_generated_by_admin_id_idx`(`generated_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generated_codes` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `category` ENUM('ACTIVATION', 'TOP_UP', 'BENEFICIARY') NOT NULL,
    `status` ENUM('AVAILABLE', 'USED', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE',
    `activation_type` ENUM('BASIC', 'PREMIUM') NULL,
    `top_up_amount` INTEGER UNSIGNED NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generated_by_admin_id` VARCHAR(191) NULL,
    `generated_by_admin_name` VARCHAR(191) NULL,
    `expires_at` DATETIME(3) NULL,
    `used_at` DATETIME(3) NULL,
    `used_by_member_id` CHAR(36) NULL,
    `used_by_member_name` VARCHAR(300) NULL,
    `disabled_at` DATETIME(3) NULL,
    `disabled_by_admin_id` VARCHAR(191) NULL,
    `disabled_reason` VARCHAR(500) NULL,
    `generation_batch_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `generated_codes_code_key`(`code`),
    INDEX `generated_codes_category_status_idx`(`category`, `status`),
    INDEX `generated_codes_activation_type_status_idx`(`activation_type`, `status`),
    INDEX `generated_codes_top_up_amount_status_idx`(`top_up_amount`, `status`),
    INDEX `generated_codes_generated_at_idx`(`generated_at`),
    INDEX `generated_codes_expires_at_idx`(`expires_at`),
    INDEX `generated_codes_used_by_member_id_idx`(`used_by_member_id`),
    INDEX `generated_codes_generation_batch_id_idx`(`generation_batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `generated_codes` ADD CONSTRAINT `generated_codes_generation_batch_id_fkey` FOREIGN KEY (`generation_batch_id`) REFERENCES `generated_code_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_codes` ADD CONSTRAINT `generated_codes_used_by_member_id_fkey` FOREIGN KEY (`used_by_member_id`) REFERENCES `members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
