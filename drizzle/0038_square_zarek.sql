ALTER TABLE `fiscal_documents` MODIFY COLUMN `orderId` int;--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `tableSessionId` int;--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `consolidatedOrderIds` text;--> statement-breakpoint
ALTER TABLE `fiscal_settings` ADD `providerApiTokenEncrypted` text;--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD CONSTRAINT `fiscal_documents_table_session_unique` UNIQUE(`tableSessionId`);