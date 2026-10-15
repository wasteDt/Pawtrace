ALTER TABLE `professional_applications`
  ADD COLUMN `purpose` ENUM('INITIAL', 'UPGRADE') NOT NULL DEFAULT 'INITIAL',
  ADD COLUMN `previous_type` ENUM('VETERINARIAN', 'ASSISTANT') NULL;

-- Preserve any upgrade applications submitted through the API before the UI exposed an upgrade entry.
UPDATE `professional_applications` AS application
JOIN `professional_profiles` AS profile ON profile.`user_id` = application.`user_id`
SET application.`purpose` = 'UPGRADE', application.`previous_type` = 'ASSISTANT'
WHERE application.`status` = 'PENDING'
  AND application.`requested_type` = 'VETERINARIAN'
  AND profile.`type` = 'ASSISTANT'
  AND profile.`status` = 'APPROVED';
