CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gateway` varchar(40) NOT NULL,
	`eventKey` varchar(200) NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_gateway_key_unique` UNIQUE(`gateway`,`eventKey`)
);
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `status` enum('PENDING','PAID','CANCELLED','REFUNDED','EXPIRED') NOT NULL DEFAULT 'PENDING';