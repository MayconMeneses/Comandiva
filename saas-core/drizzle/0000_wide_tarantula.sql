CREATE TABLE `restaurants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`contactName` varchar(160),
	`contactEmail` varchar(320),
	`contactPhone` varchar(24),
	`apiKeyHash` varchar(64) NOT NULL,
	`apiKeyPrefix` varchar(16) NOT NULL,
	`status` enum('active','suspended','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `restaurants_id` PRIMARY KEY(`id`),
	CONSTRAINT `restaurants_api_key_hash_unique` UNIQUE(`apiKeyHash`)
);
--> statement-breakpoint
CREATE TABLE `features` (
	`featureId` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`category` varchar(60),
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `features_featureId` PRIMARY KEY(`featureId`)
);
--> statement-breakpoint
CREATE TABLE `plan_features` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`featureId` varchar(60) NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `plan_features_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_features_unique` UNIQUE(`planId`,`featureId`)
);
--> statement-breakpoint
CREATE TABLE `plan_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`resourceKey` varchar(60) NOT NULL,
	`limitValue` int,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `plan_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_limits_unique` UNIQUE(`planId`,`resourceKey`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` enum('essencial','profissional','premium') NOT NULL,
	`name` varchar(80) NOT NULL,
	`priceCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`position` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_key_unique` UNIQUE(`key`),
	CONSTRAINT `plans_position_unique` UNIQUE(`position`)
);
--> statement-breakpoint
CREATE TABLE `billing_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`gateway` varchar(40) NOT NULL,
	`gatewayPaymentId` varchar(160),
	`amountCents` int NOT NULL,
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`paidAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `billing_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`restaurantId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('trial','active','payment_pending','past_due','cancel_at_period_end','canceled','suspended','ended') NOT NULL DEFAULT 'trial',
	`startedAt` bigint unsigned NOT NULL,
	`currentPeriodStart` bigint unsigned NOT NULL,
	`currentPeriodEnd` bigint unsigned NOT NULL,
	`nextBillingAt` bigint unsigned,
	`canceledAt` bigint unsigned,
	`cancelReason` varchar(500),
	`gateway` enum('MANUAL','MERCADO_PAGO') NOT NULL DEFAULT 'MANUAL',
	`gatewayCustomerId` varchar(160),
	`gatewaySubscriptionId` varchar(160),
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_restaurant_unique` UNIQUE(`restaurantId`)
);
--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`beforeJson` text,
	`afterJson` text,
	`actor` varchar(160),
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `subscription_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gateway` varchar(40) NOT NULL,
	`gatewayEventId` varchar(160) NOT NULL,
	`processedAt` bigint unsigned NOT NULL,
	`result` varchar(40) NOT NULL,
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_gateway_event_unique` UNIQUE(`gateway`,`gatewayEventId`)
);
--> statement-breakpoint
CREATE INDEX `restaurants_status_idx` ON `restaurants` (`status`);--> statement-breakpoint
CREATE INDEX `billing_payments_subscription_idx` ON `billing_payments` (`subscriptionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `subscription_events_subscription_idx` ON `subscription_events` (`subscriptionId`,`createdAt`);