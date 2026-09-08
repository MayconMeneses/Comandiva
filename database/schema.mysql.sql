CREATE TABLE `addon_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`minSelections` int NOT NULL DEFAULT 0,
	`maxSelections` int NOT NULL DEFAULT 5,
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `addon_groups_id` PRIMARY KEY(`id`)
);

CREATE TABLE `addon_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`priceCents` int NOT NULL DEFAULT 0,
	`available` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `addon_options_id` PRIMARY KEY(`id`)
);

CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);

CREATE TABLE `customer_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`label` varchar(50) NOT NULL DEFAULT 'Principal',
	`recipientName` varchar(160) NOT NULL,
	`postalCode` varchar(12),
	`street` varchar(180) NOT NULL,
	`number` varchar(30) NOT NULL,
	`complement` varchar(120),
	`neighborhood` varchar(120) NOT NULL,
	`city` varchar(120) NOT NULL,
	`state` varchar(2) NOT NULL,
	`reference` varchar(255),
	`isDefault` boolean NOT NULL DEFAULT true,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`)
);

CREATE TABLE `customer_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`changeType` varchar(80) NOT NULL,
	`details` text NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `customer_change_logs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(24) NOT NULL,
	`name` varchar(160) NOT NULL,
	`phoneVerifiedAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_unique` UNIQUE(`phone`)
);

CREATE TABLE `delivery_routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`coverageNotes` varchar(255),
	`deliveryFeeCents` int NOT NULL,
	`estimatedDeliveryMin` int NOT NULL DEFAULT 30,
	`estimatedDeliveryMax` int NOT NULL DEFAULT 50,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `delivery_routes_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`changedByUserId` int,
	`changeType` varchar(80) NOT NULL,
	`details` text NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `order_change_logs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_item_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderItemId` int NOT NULL,
	`addonGroupName` varchar(120) NOT NULL,
	`addonOptionName` varchar(120) NOT NULL,
	`unitPriceCents` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `order_item_addons_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`productName` varchar(140) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`lineTotalCents` int NOT NULL,
	`note` varchar(500),
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` enum('PENDING','ACCEPTED','PREPARING','OUT_FOR_DELIVERY','READY_FOR_PICKUP','COMPLETED','CANCELLED') NOT NULL,
	`note` varchar(500),
	`changedByUserId` int,
	`createdAt` bigint unsigned NOT NULL,
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicCode` varchar(16) NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`fulfillmentType` enum('DELIVERY','PICKUP') NOT NULL,
	`status` enum('PENDING','ACCEPTED','PREPARING','OUT_FOR_DELIVERY','READY_FOR_PICKUP','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`paymentMethod` enum('PIX','CASH','CARD_ON_DELIVERY') NOT NULL,
	`paymentStatus` enum('PENDING','PAID') NOT NULL DEFAULT 'PENDING',
	`subtotalCents` int NOT NULL,
	`deliveryFeeCents` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`changeForCents` int,
	`customerNote` varchar(500),
	`internalNote` varchar(500),
	`deliveryRouteId` int,
	`deliveryRouteName` varchar(120),
	`adminAttachmentUrl` varchar(2048),
	`adminAttachmentLabel` varchar(160),
	`archivedAt` bigint unsigned,
	`deliveryPostalCode` varchar(12),
	`deliveryStreet` varchar(180),
	`deliveryNumber` varchar(30),
	`deliveryComplement` varchar(120),
	`deliveryNeighborhood` varchar(120),
	`deliveryCity` varchar(120),
	`deliveryState` varchar(2),
	`deliveryReference` varchar(255),
	`acceptedAt` bigint unsigned,
	`completedAt` bigint unsigned,
	`cancelledAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_public_code_unique` UNIQUE(`publicCode`)
);

CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`method` enum('PIX','CASH','CARD_ON_DELIVERY') NOT NULL,
	`status` enum('PENDING','PAID','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
	`amountCents` int NOT NULL,
	`providerReference` varchar(160),
	`metadata` text,
	`paidAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_order_unique` UNIQUE(`orderId`)
);

CREATE TABLE `print_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` enum('PENDING','SENT','PRINTED','FAILED') NOT NULL DEFAULT 'PENDING',
	`receiptPayload` text NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(500),
	`printedAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `print_jobs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(140) NOT NULL,
	`description` text,
	`imageUrl` varchar(2048),
	`priceCents` int NOT NULL,
	`preparationMinutes` int NOT NULL DEFAULT 20,
	`available` boolean NOT NULL DEFAULT true,
	`featured` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`archivedAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);

CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(140) NOT NULL,
	`description` varchar(500),
	`badge` varchar(80),
	`priceLabel` varchar(60),
	`imageUrl` varchar(2048),
	`validDays` varchar(160),
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `restaurant_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeName` varchar(120) NOT NULL,
	`shortDescription` text,
	`phone` varchar(24),
	`address` text,
	`deliveryFeeCents` int NOT NULL DEFAULT 700,
	`minimumOrderCents` int NOT NULL DEFAULT 1500,
	`estimatedDeliveryMin` int NOT NULL DEFAULT 30,
	`estimatedDeliveryMax` int NOT NULL DEFAULT 50,
	`isAcceptingOrders` boolean NOT NULL DEFAULT true,
	`openingHours` varchar(255) DEFAULT 'Hoje, 18h às 23h',
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `restaurant_settings_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','staff','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

CREATE INDEX `addon_groups_product_idx` ON `addon_groups` (`productId`,`sortOrder`);
CREATE INDEX `addon_options_group_idx` ON `addon_options` (`groupId`,`sortOrder`);
CREATE INDEX `categories_active_sort_idx` ON `categories` (`active`,`sortOrder`);
CREATE INDEX `customer_addresses_customer_idx` ON `customer_addresses` (`customerId`,`isDefault`);
CREATE INDEX `customer_change_customer_idx` ON `customer_change_logs` (`customerId`,`createdAt`);
CREATE INDEX `delivery_routes_active_sort_idx` ON `delivery_routes` (`active`,`sortOrder`);
CREATE INDEX `order_change_logs_order_idx` ON `order_change_logs` (`orderId`,`createdAt`);
CREATE INDEX `order_item_addons_item_idx` ON `order_item_addons` (`orderItemId`);
CREATE INDEX `order_items_order_idx` ON `order_items` (`orderId`);
CREATE INDEX `order_status_history_order_idx` ON `order_status_history` (`orderId`,`createdAt`);
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`createdAt`);
CREATE INDEX `orders_customer_created_idx` ON `orders` (`customerId`,`createdAt`);
CREATE INDEX `payments_status_created_idx` ON `payments` (`status`,`createdAt`);
CREATE INDEX `print_jobs_status_idx` ON `print_jobs` (`status`,`createdAt`);
CREATE INDEX `products_category_idx` ON `products` (`categoryId`,`sortOrder`);
CREATE INDEX `products_available_idx` ON `products` (`available`);
CREATE INDEX `promotions_active_sort_idx` ON `promotions` (`active`,`sortOrder`);
