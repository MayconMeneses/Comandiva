CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`method` enum('PIX','CASH','CARD_ON_DELIVERY') NOT NULL,
	`status` enum('PENDING','PAID','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`amountCents` int NOT NULL,
	`providerReference` varchar(160),
	`metadata` text,
	`paidAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_order_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE INDEX `payments_status_created_idx` ON `payments` (`status`,`createdAt`);