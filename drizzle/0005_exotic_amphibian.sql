CREATE TABLE `delivery_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`coverageNotes` varchar(255),
	`deliveryFeeCents` int NOT NULL,
	`estimatedDeliveryMin` int NOT NULL DEFAULT 30,
	`estimatedDeliveryMax` int NOT NULL DEFAULT 50,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `delivery_routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryRouteId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryRouteName` varchar(120);--> statement-breakpoint
CREATE INDEX `delivery_routes_active_sort_idx` ON `delivery_routes` (`active`,`sortOrder`);