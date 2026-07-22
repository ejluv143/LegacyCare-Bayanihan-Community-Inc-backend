-- CreateTable
CREATE TABLE `beneficiaries` (
    `id` CHAR(36) NOT NULL,
    `beneficiary_id` VARCHAR(40) NOT NULL,
    `sequence_number` INTEGER NOT NULL,
    `primary_member_id` CHAR(36) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `relationship` VARCHAR(50) NOT NULL,
    `address` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `beneficiaries_beneficiary_id_key`(`beneficiary_id`),
    INDEX `beneficiaries_primary_member_id_idx`(`primary_member_id`),
    UNIQUE INDEX `beneficiaries_primary_member_id_sequence_number_key`(`primary_member_id`, `sequence_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `beneficiaries` ADD CONSTRAINT `beneficiaries_primary_member_id_fkey` FOREIGN KEY (`primary_member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
