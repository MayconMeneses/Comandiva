CREATE TABLE `account_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`actorName` varchar(160) NOT NULL,
	`action` varchar(80) NOT NULL,
	`entityType` varchar(40),
	`entityId` int,
	`beforeJson` text,
	`afterJson` text,
	`ip` varchar(64),
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `account_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `account_audit_log_created_idx` ON `account_audit_log` (`createdAt`);