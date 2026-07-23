-- AlterTable
ALTER TABLE `members` ADD COLUMN `satellite_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `satellites` (
    `id` CHAR(36) NOT NULL,
    `satellite_code` VARCHAR(30) NOT NULL,
    `satellite_name` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `business_type` ENUM('FRANCHISE', 'COMPANY_OWNED', 'AFFILIATE') NOT NULL,
    `satellite_level` ENUM('REGIONAL', 'PROVINCIAL', 'CITY', 'BARANGAY') NOT NULL,
    `region` VARCHAR(150) NOT NULL,
    `province` VARCHAR(150) NOT NULL,
    `city` VARCHAR(150) NOT NULL,
    `barangay` VARCHAR(150) NOT NULL,
    `street_address` TEXT NOT NULL,
    `zip_code` VARCHAR(20) NULL,
    `opening_date` DATE NULL,
    `coverage_area` TEXT NOT NULL,
    `operating_hours` VARCHAR(191) NOT NULL,
    `maximum_members` INTEGER UNSIGNED NOT NULL DEFAULT 1000,
    `commission_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `satellites_satellite_code_key`(`satellite_code`),
    INDEX `satellites_status_idx`(`status`),
    INDEX `satellites_business_type_idx`(`business_type`),
    INDEX `satellites_satellite_level_idx`(`satellite_level`),
    INDEX `satellites_region_idx`(`region`),
    INDEX `satellites_province_idx`(`province`),
    INDEX `satellites_city_idx`(`city`),
    INDEX `satellites_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `satellite_managers` (
    `id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `suffix` VARCHAR(20) NULL,
    `birth_date` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY') NULL,
    `civil_status` ENUM('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED') NOT NULL,
    `nationality` VARCHAR(100) NOT NULL DEFAULT 'Filipino',
    `contact_number` VARCHAR(30) NOT NULL,
    `alternate_contact_number` VARCHAR(30) NULL,
    `email` VARCHAR(191) NOT NULL,
    `valid_id_type` VARCHAR(100) NULL,
    `valid_id_number` VARCHAR(191) NULL,
    `tax_identification_number` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `satellite_managers_satellite_id_key`(`satellite_id`),
    UNIQUE INDEX `satellite_managers_contact_number_key`(`contact_number`),
    UNIQUE INDEX `satellite_managers_email_key`(`email`),
    UNIQUE INDEX `satellite_managers_valid_id_number_key`(`valid_id_number`),
    UNIQUE INDEX `satellite_managers_tax_identification_number_key`(`tax_identification_number`),
    INDEX `satellite_managers_satellite_id_idx`(`satellite_id`),
    INDEX `satellite_managers_last_name_first_name_idx`(`last_name`, `first_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `satellite_payout_accounts` (
    `id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NOT NULL,
    `gcash_number` VARCHAR(30) NULL,
    `bank_name` VARCHAR(150) NULL,
    `bank_account_name` VARCHAR(191) NULL,
    `bank_account_number` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `satellite_payout_accounts_satellite_id_key`(`satellite_id`),
    INDEX `satellite_payout_accounts_satellite_id_idx`(`satellite_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `satellite_accounts` (
    `id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SATELLITE_ADMIN', 'MANAGER') NOT NULL DEFAULT 'SATELLITE_ADMIN',
    `status` ENUM('ACTIVE', 'DISABLED', 'LOCKED') NOT NULL DEFAULT 'DISABLED',
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `satellite_accounts_satellite_id_key`(`satellite_id`),
    UNIQUE INDEX `satellite_accounts_username_key`(`username`),
    INDEX `satellite_accounts_satellite_id_idx`(`satellite_id`),
    INDEX `satellite_accounts_status_idx`(`status`),
    INDEX `satellite_accounts_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `satellite_permissions` (
    `id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NOT NULL,
    `can_register_members` BOOLEAN NOT NULL DEFAULT true,
    `can_activate_members` BOOLEAN NOT NULL DEFAULT false,
    `can_process_claims` BOOLEAN NOT NULL DEFAULT false,
    `can_view_genealogy` BOOLEAN NOT NULL DEFAULT true,
    `can_manage_beneficiaries` BOOLEAN NOT NULL DEFAULT true,
    `can_view_transactions` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `satellite_permissions_satellite_id_key`(`satellite_id`),
    INDEX `satellite_permissions_satellite_id_idx`(`satellite_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `satellite_status_history` (
    `id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NOT NULL,
    `previous_status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'CLOSED') NOT NULL,
    `new_status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'CLOSED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `changed_by_admin_id` VARCHAR(191) NULL,
    `changed_by_admin_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `satellite_status_history_satellite_id_idx`(`satellite_id`),
    INDEX `satellite_status_history_new_status_idx`(`new_status`),
    INDEX `satellite_status_history_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `members_satellite_id_idx` ON `members`(`satellite_id`);

-- CreateIndex
CREATE INDEX `members_membership_type_idx` ON `members`(`membership_type`);

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_managers` ADD CONSTRAINT `satellite_managers_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_payout_accounts` ADD CONSTRAINT `satellite_payout_accounts_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_accounts` ADD CONSTRAINT `satellite_accounts_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_permissions` ADD CONSTRAINT `satellite_permissions_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `satellite_status_history` ADD CONSTRAINT `satellite_status_history_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
