CREATE TABLE `subscription_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planKey` varchar(40) NOT NULL DEFAULT 'essencial',
	`planName` varchar(80) NOT NULL DEFAULT 'Essencial',
	`status` varchar(40) NOT NULL DEFAULT 'trial',
	`featuresJson` text,
	`limitsJson` text,
	`lockedFeaturesJson` text,
	`currentPeriodEnd` bigint unsigned,
	`lastSyncOk` boolean NOT NULL DEFAULT false,
	`syncedAt` bigint unsigned,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `subscription_cache_id` PRIMARY KEY(`id`)
);
