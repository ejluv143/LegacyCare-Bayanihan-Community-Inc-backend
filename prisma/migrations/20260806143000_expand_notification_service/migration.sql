ALTER TABLE `notifications`
  ADD COLUMN `channel` ENUM('IN_APP', 'EMAIL', 'PUSH') NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN `is_read` BOOLEAN NOT NULL DEFAULT false;

UPDATE `notifications`
SET `is_read` = (`read_at` IS NOT NULL);

ALTER TABLE `notifications`
  MODIFY COLUMN `type` ENUM(
    'MEMBERSHIP', 'WALLET', 'CLAIM', 'BENEFIT', 'REFERRAL',
    'SECURITY', 'ANNOUNCEMENT', 'SYSTEM', 'INFO', 'ALERT', 'MARKETING'
  ) NOT NULL DEFAULT 'INFO';

UPDATE `notifications`
SET `type` = 'INFO';

ALTER TABLE `notifications`
  MODIFY COLUMN `type` ENUM('INFO', 'ALERT', 'MARKETING') NOT NULL DEFAULT 'INFO',
  CHANGE COLUMN `message` `content` TEXT NOT NULL,
  DROP COLUMN `action_url`,
  DROP COLUMN `read_at`;

DROP INDEX `notifications_member_id_read_at_idx` ON `notifications`;
CREATE INDEX `notifications_member_id_is_read_idx`
  ON `notifications` (`member_id`, `is_read`);
