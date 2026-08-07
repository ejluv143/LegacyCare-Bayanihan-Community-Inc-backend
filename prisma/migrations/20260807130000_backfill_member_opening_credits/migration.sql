-- Existing members predate the wallet ledger. Give each member the same
-- one-time opening credit that all newly created members receive.
--
-- The wallet credit remains a single member-owned ledger entry. The API's
-- primary-member plus four-beneficiary breakdown is informational and must
-- never create five separately spendable balances.
INSERT INTO `wallet_transactions` (
    `id`,
    `member_id`,
    `type`,
    `direction`,
    `status`,
    `amount`,
    `source_key`,
    `generated_code_id`,
    `description`,
    `created_at`,
    `updated_at`
)
SELECT
    UUID(),
    `member`.`id`,
    'OPENING_CREDIT',
    'CREDIT',
    'COMPLETED',
    200.00,
    CONCAT('opening-credit:', `member`.`id`),
    NULL,
    'One-time new member opening credit.',
    `member`.`created_at`,
    `member`.`created_at`
FROM `members` AS `member`
WHERE NOT EXISTS (
    SELECT 1
    FROM `wallet_transactions` AS `existing_credit`
    WHERE
        `existing_credit`.`source_key` = CONCAT(
            'opening-credit:',
            `member`.`id`
        )
        OR (
            `existing_credit`.`member_id` = `member`.`id`
            AND `existing_credit`.`type` = 'OPENING_CREDIT'
        )
)
ON DUPLICATE KEY UPDATE
    `source_key` = `wallet_transactions`.`source_key`;
