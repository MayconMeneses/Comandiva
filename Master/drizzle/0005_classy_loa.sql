ALTER TABLE `platform_admins` MODIFY COLUMN `role` enum('owner','member') NOT NULL DEFAULT 'owner';--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `permissions` text;