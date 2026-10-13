CREATE TABLE `restaurant_staff_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	`lastSignedInAt` bigint unsigned,
	CONSTRAINT `restaurant_staff_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_credentials_username_unique` UNIQUE(`username`),
	CONSTRAINT `staff_credentials_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','staff','admin') NOT NULL DEFAULT 'user';