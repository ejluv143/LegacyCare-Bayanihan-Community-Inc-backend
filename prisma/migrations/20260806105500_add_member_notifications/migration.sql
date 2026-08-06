CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `member_id` CHAR(36) NOT NULL,
  `type` ENUM(
    'MEMBERSHIP',
    'WALLET',
    'CLAIM',
    'BENEFIT',
    'REFERRAL',
    'SECURITY',
    'ANNOUNCEMENT',
    'SYSTEM'
  ) NOT NULL DEFAULT 'SYSTEM',
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `action_url` VARCHAR(500) NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `notifications_member_id_read_at_idx` (`member_id`, `read_at`),
  INDEX `notifications_member_id_created_at_idx` (`member_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `notifications_member_id_fkey`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `notifications` (
  `id`,
  `member_id`,
  `type`,
  `title`,
  `message`,
  `action_url`,
  `created_at`,
  `updated_at`
)
SELECT
  UUID(),
  `id`,
  'MEMBERSHIP',
  'Welcome to Legacy Care',
  'Your member notifications are now active. Important membership and account updates will appear here.',
  '/dashboard',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `members`;
