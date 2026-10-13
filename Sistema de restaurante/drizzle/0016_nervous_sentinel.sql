CREATE TABLE `faq_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` varchar(300) NOT NULL,
	`answer` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `faq_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `restaurant_settings` ADD `aboutText` text;