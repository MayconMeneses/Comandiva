CREATE INDEX `orders_created_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `order_status_history_created_idx` ON `order_status_history` (`createdAt`);--> statement-breakpoint
CREATE INDEX `order_change_logs_created_idx` ON `order_change_logs` (`createdAt`);
