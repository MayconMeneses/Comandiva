ALTER TABLE `plans` ADD `maintenanceCents` int;--> statement-breakpoint
UPDATE `plans` SET `maintenanceCents` = 5000 WHERE `key` = 'essencial';
