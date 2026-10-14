ALTER TABLE `payment_gateways` MODIFY COLUMN `apiKey` varchar(2048);--> statement-breakpoint
ALTER TABLE `payment_gateways` MODIFY COLUMN `secretKey` varchar(2048);