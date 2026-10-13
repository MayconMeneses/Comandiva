DROP INDEX `orders_customer_created_idx` ON `orders`;--> statement-breakpoint
CREATE INDEX `orders_customer_phone_created_idx` ON `orders` (`customerPhone`,`createdAt`);