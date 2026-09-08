ALTER TABLE `payments` ADD `refundedAt` bigint unsigned;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundedByUserId` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `refundReason` varchar(500);