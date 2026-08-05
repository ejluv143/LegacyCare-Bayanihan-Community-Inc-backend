UPDATE `generated_codes` AS `generated_code`
INNER JOIN `members` AS `member`
  ON `member`.`activation_code_hash` = SHA2(`generated_code`.`code`, 256)
SET
  `generated_code`.`status` = 'USED',
  `generated_code`.`used_at` = COALESCE(
    `member`.`activated_at`,
    `member`.`created_at`,
    CURRENT_TIMESTAMP(3)
  ),
  `generated_code`.`used_by_member_id` = `member`.`id`,
  `generated_code`.`used_by_member_name` = TRIM(
    CONCAT_WS(
      ' ',
      `member`.`first_name`,
      NULLIF(`member`.`middle_name`, ''),
      `member`.`last_name`
    )
  )
WHERE
  `generated_code`.`category` = 'ACTIVATION'
  AND `generated_code`.`status` IN ('AVAILABLE', 'ASSIGNED');
