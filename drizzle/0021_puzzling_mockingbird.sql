CREATE TABLE `table_service_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableSessionId` int NOT NULL,
	`status` enum('PENDING','ACKNOWLEDGED','DONE','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`createdAt` bigint unsigned NOT NULL,
	`resolvedAt` bigint unsigned,
	`resolvedByUserId` int,
	CONSTRAINT `table_service_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `origin` enum('SITE','BALCAO','GARCOM','QR_CODE') DEFAULT 'SITE' NOT NULL;--> statement-breakpoint
CREATE INDEX `table_service_requests_session_status_idx` ON `table_service_requests` (`tableSessionId`,`status`);