CREATE TABLE `promotion_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promotionId` int NOT NULL,
	`productId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `promotion_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotion_products_unique` UNIQUE(`promotionId`,`productId`)
);
--> statement-breakpoint
CREATE INDEX `promotion_products_promotion_idx` ON `promotion_products` (`promotionId`);--> statement-breakpoint
INSERT INTO `promotion_products` (`promotionId`, `productId`, `sortOrder`, `createdAt`)
SELECT `id`, `linkedProductId`, 0, UNIX_TIMESTAMP(NOW(3)) * 1000
FROM `promotions`
WHERE `linkedProductId` IS NOT NULL;