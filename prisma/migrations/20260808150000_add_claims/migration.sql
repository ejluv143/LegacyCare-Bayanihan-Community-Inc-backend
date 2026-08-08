-- CreateTable
CREATE TABLE `claims` (
    `id` CHAR(36) NOT NULL,
    `claim_number` VARCHAR(30) NOT NULL,
    `type` ENUM('NATURAL_DEATH', 'ACCIDENTAL_DEATH') NOT NULL DEFAULT 'NATURAL_DEATH',
    `status` ENUM('SUBMITTED', 'SATELLITE_REVIEW', 'NEEDS_CORRECTION', 'FORWARDED_TO_ADMIN', 'ADMIN_REVIEW', 'APPROVED', 'PROCESSING_PAYMENT', 'PAID', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `member_id` CHAR(36) NOT NULL,
    `beneficiary_id` CHAR(36) NOT NULL,
    `satellite_id` CHAR(36) NULL,
    `claimant_name` VARCHAR(191) NOT NULL,
    `claimant_relationship` VARCHAR(100) NOT NULL,
    `claimant_contact_number` VARCHAR(30) NOT NULL,
    `date_of_death` DATE NOT NULL,
    `place_of_death` VARCHAR(255) NOT NULL,
    `cause_of_death` VARCHAR(255) NOT NULL,
    `bank_name` VARCHAR(150) NOT NULL,
    `account_name` VARCHAR(191) NOT NULL,
    `account_number` VARCHAR(100) NOT NULL,
    `remarks` TEXT NULL,
    `requested_amount` DECIMAL(12, 2) NOT NULL,
    `approved_amount` DECIMAL(12, 2) NULL,
    `satellite_reviewed_at` DATETIME(3) NULL,
    `satellite_reviewed_by_account` VARCHAR(191) NULL,
    `satellite_remarks` TEXT NULL,
    `forwarded_to_admin_at` DATETIME(3) NULL,
    `admin_reviewed_at` DATETIME(3) NULL,
    `admin_reviewed_by_admin` VARCHAR(191) NULL,
    `admin_remarks` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `paid_at` DATETIME(3) NULL,
    `payout_reference` VARCHAR(191) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `claims_claim_number_key`(`claim_number`),
    INDEX `claims_member_id_idx`(`member_id`),
    INDEX `claims_beneficiary_id_idx`(`beneficiary_id`),
    INDEX `claims_satellite_id_status_idx`(`satellite_id`, `status`),
    INDEX `claims_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `claim_documents` (
    `id` CHAR(36) NOT NULL,
    `claim_id` CHAR(36) NOT NULL,
    `type` ENUM('CLAIM_FORM', 'DEATH_CERTIFICATE', 'BARANGAY_CERTIFICATE', 'VALID_ID', 'MARRIAGE_OR_BIRTH_CERTIFICATE', 'MEMBERSHIP_VERIFICATION', 'MEDICAL_RECORDS', 'AFFIDAVIT_OF_CLAIMANT', 'BANK_ACCOUNT_DETAILS', 'OTHER') NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('PENDING', 'VERIFIED', 'INVALID') NOT NULL DEFAULT 'PENDING',
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_data` LONGTEXT NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by_account` VARCHAR(191) NULL,
    `review_remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `claim_documents_claim_id_type_key`(`claim_id`, `type`),
    INDEX `claim_documents_claim_id_idx`(`claim_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `claim_status_history` (
    `id` CHAR(36) NOT NULL,
    `claim_id` CHAR(36) NOT NULL,
    `status` ENUM('SUBMITTED', 'SATELLITE_REVIEW', 'NEEDS_CORRECTION', 'FORWARDED_TO_ADMIN', 'ADMIN_REVIEW', 'APPROVED', 'PROCESSING_PAYMENT', 'PAID', 'REJECTED', 'CANCELLED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `actor_type` VARCHAR(20) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `actor_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `claim_status_history_claim_id_idx`(`claim_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `claims` ADD CONSTRAINT `claims_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `claims` ADD CONSTRAINT `claims_beneficiary_id_fkey` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `claims` ADD CONSTRAINT `claims_satellite_id_fkey` FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `claim_documents` ADD CONSTRAINT `claim_documents_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `claim_status_history` ADD CONSTRAINT `claim_status_history_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
