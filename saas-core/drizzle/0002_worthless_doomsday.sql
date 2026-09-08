CREATE TABLE `support_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`platformAdminId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`issuedAt` bigint unsigned NOT NULL,
	`expiresAt` bigint unsigned NOT NULL,
	`usedAt` bigint unsigned,
	`endedAt` bigint unsigned,
	`issuedFromIp` varchar(64),
	CONSTRAINT `support_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_sessions_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `deploymentUrl` varchar(500);--> statement-breakpoint
CREATE INDEX `support_sessions_restaurant_idx` ON `support_sessions` (`restaurantId`,`issuedAt`);