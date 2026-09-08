CREATE TABLE `promotion_addon_defaults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promotionId` int NOT NULL,
	`productId` int NOT NULL,
	`addonGroupId` int NOT NULL,
	`mode` enum('ADMIN_DEFAULT','CUSTOMER_CHOICE') NOT NULL DEFAULT 'CUSTOMER_CHOICE',
	`defaultOptionId` int,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `promotion_addon_defaults_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotion_addon_defaults_unique` UNIQUE(`promotionId`,`productId`,`addonGroupId`)
);
--> statement-breakpoint
CREATE INDEX `promotion_addon_defaults_promotion_idx` ON `promotion_addon_defaults` (`promotionId`);