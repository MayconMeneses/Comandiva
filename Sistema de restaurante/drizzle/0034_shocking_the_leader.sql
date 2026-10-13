CREATE TABLE `fiscal_tax_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`notes` varchar(500),
	`csosn` varchar(3),
	`cst` varchar(2),
	`icmsRateBasisPoints` int,
	`pisRateBasisPoints` int,
	`cofinsRateBasisPoints` int,
	`cfop` varchar(4),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `fiscal_tax_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `fiscalCategoryId` int;--> statement-breakpoint
CREATE INDEX `fiscal_tax_categories_active_idx` ON `fiscal_tax_categories` (`active`);