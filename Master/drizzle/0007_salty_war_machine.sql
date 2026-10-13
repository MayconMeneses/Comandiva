CREATE TABLE `signup_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` json NOT NULL,
	`mpPreferenceId` varchar(160),
	`mpPaymentId` varchar(160),
	`amountCents` int NOT NULL,
	`status` enum('pending','paid','restaurant_created','expired') NOT NULL DEFAULT 'pending',
	`restaurantId` int,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `signup_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `signup_payments_preference_unique` UNIQUE(`mpPreferenceId`)
);
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `promoEligible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `promoDiscountCyclesRemaining` int;