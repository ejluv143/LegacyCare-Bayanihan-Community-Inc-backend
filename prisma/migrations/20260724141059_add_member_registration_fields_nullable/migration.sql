ALTER TABLE `members`
  ADD COLUMN `address` TEXT NULL,
  ADD COLUMN `date_of_birth` DATE NULL,
  ADD COLUMN `member_since` DATE NULL,
  ADD COLUMN `activated_at` DATETIME(3) NULL;