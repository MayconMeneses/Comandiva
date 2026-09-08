ALTER TABLE `categories` ADD `imageUrl` varchar(500);
--> statement-breakpoint
ALTER TABLE `categories` ADD `timeAvailability` enum('ALWAYS','LUNCH','DINNER','LUNCH_AND_DINNER') NOT NULL DEFAULT 'ALWAYS';
--> statement-breakpoint
ALTER TABLE `restaurant_settings` ADD `lunchStartTime` varchar(5);
--> statement-breakpoint
ALTER TABLE `restaurant_settings` ADD `lunchEndTime` varchar(5);
--> statement-breakpoint
ALTER TABLE `restaurant_settings` ADD `dinnerStartTime` varchar(5);
--> statement-breakpoint
ALTER TABLE `restaurant_settings` ADD `dinnerEndTime` varchar(5);
