CREATE TABLE `phone_verification_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(24) NOT NULL,
	`codeHash` varchar(255) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`consumedAt` bigint unsigned,
	`expiresAt` bigint unsigned NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `phone_verification_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `phone_verification_codes_phone_idx` ON `phone_verification_codes` (`phone`,`createdAt`);