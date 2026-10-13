CREATE TABLE `order_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`changedByUserId` int,
	`changeType` varchar(80) NOT NULL,
	`details` text NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `order_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `adminAttachmentUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `orders` ADD `adminAttachmentLabel` varchar(160);--> statement-breakpoint
ALTER TABLE `orders` ADD `archivedAt` bigint unsigned;--> statement-breakpoint
CREATE INDEX `order_change_logs_order_idx` ON `order_change_logs` (`orderId`,`createdAt`);