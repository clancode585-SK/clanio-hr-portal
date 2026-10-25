-- Har SOD/EOD point ab apna status rakhta hai (Excel sheet jaisa):
-- not_started / pending / wip / completed. Pehle sirf ek boolean (is_completed) tha.

ALTER TABLE `daily_report_items`
    ADD COLUMN `status` VARCHAR(15) NOT NULL DEFAULT 'not_started' AFTER `hours`;

UPDATE `daily_report_items` SET `status` = IF(`is_completed` = 1, 'completed', 'pending');

ALTER TABLE `daily_report_items`
    DROP COLUMN `is_completed`;
