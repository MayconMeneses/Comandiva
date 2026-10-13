CREATE TABLE `platform_admin_recovery_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`usedAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `platform_admin_recovery_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admin_recovery_codes_admin_hash_unique` UNIQUE(`adminId`,`codeHash`)
);
--> statement-breakpoint
ALTER TABLE `platform_admins` MODIFY COLUMN `totpSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `totpLastStep` bigint unsigned;--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `sessionsValidAfter` bigint unsigned;