ALTER TABLE `orders` ADD `clientOperationId` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_client_operation_id_unique` UNIQUE(`clientOperationId`);