CREATE TABLE `platform_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorAdminId` int,
	`actorLabel` varchar(160) NOT NULL,
	`action` varchar(80) NOT NULL,
	`entityType` varchar(40),
	`entityId` int,
	`beforeJson` text,
	`afterJson` text,
	`ip` varchar(64),
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `platform_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('owner','platform_support','platform_finance','platform_operations') NOT NULL DEFAULT 'owner',
	`active` boolean NOT NULL DEFAULT true,
	`lastSignedInAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `platform_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `platform_audit_log_created_idx` ON `platform_audit_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_action_idx` ON `platform_audit_log` (`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `platform_audit_log_entity_idx` ON `platform_audit_log` (`entityType`,`entityId`,`createdAt`);