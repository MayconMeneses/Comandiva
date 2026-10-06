CREATE TABLE `site_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`day` varchar(10) NOT NULL,
	`path` varchar(120) NOT NULL,
	`event` varchar(32) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `site_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_events_day_path_event_unique` UNIQUE(`day`,`path`,`event`)
);
