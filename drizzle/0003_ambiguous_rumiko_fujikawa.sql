CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(140) NOT NULL,
	`description` varchar(500),
	`badge` varchar(80),
	`priceLabel` varchar(60),
	`imageUrl` varchar(2048),
	`validDays` varchar(160),
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `promotions_active_sort_idx` ON `promotions` (`active`,`sortOrder`);