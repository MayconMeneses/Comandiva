CREATE TABLE `restaurant_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(60) NOT NULL,
	`sector` varchar(60) NOT NULL DEFAULT '',
	`capacity` int NOT NULL DEFAULT 4,
	`qrToken` varchar(24) NOT NULL,
	`status` enum('FREE','OCCUPIED','AWAITING_PAYMENT','RESERVED','INACTIVE') NOT NULL DEFAULT 'FREE',
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `restaurant_tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `restaurant_tables_qr_token_unique` UNIQUE(`qrToken`)
);
--> statement-breakpoint
CREATE TABLE `table_bill_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableSessionId` int NOT NULL,
	`method` enum('PIX','CASH','CARD_ON_DELIVERY','CARD_ONLINE') NOT NULL,
	`payerLabel` varchar(60),
	`amountCents` int NOT NULL,
	`status` enum('PENDING','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`paidAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `table_bill_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `table_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`partySize` int NOT NULL,
	`reservedFor` bigint unsigned NOT NULL,
	`tableId` int,
	`status` enum('REQUESTED','CONFIRMED','SEATED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'REQUESTED',
	`notes` varchar(500),
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `table_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `table_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableId` int NOT NULL,
	`status` enum('OPEN','AWAITING_PAYMENT','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
	`partySize` int,
	`customerId` int,
	`notes` varchar(500),
	`billRequestedAt` bigint unsigned,
	`openedAt` bigint unsigned NOT NULL,
	`closedAt` bigint unsigned,
	`closedByUserId` int,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `table_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `fulfillmentType` enum('DELIVERY','PICKUP','DINE_IN') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tableSessionId` int;--> statement-breakpoint
CREATE INDEX `restaurant_tables_sector_idx` ON `restaurant_tables` (`sector`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `table_bill_payments_session_idx` ON `table_bill_payments` (`tableSessionId`);--> statement-breakpoint
CREATE INDEX `table_reservations_reserved_for_idx` ON `table_reservations` (`reservedFor`);--> statement-breakpoint
CREATE INDEX `table_reservations_status_idx` ON `table_reservations` (`status`);--> statement-breakpoint
CREATE INDEX `table_sessions_table_status_idx` ON `table_sessions` (`tableId`,`status`);--> statement-breakpoint
CREATE INDEX `table_sessions_status_idx` ON `table_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `orders_table_session_idx` ON `orders` (`tableSessionId`);