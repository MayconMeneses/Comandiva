ALTER TABLE `platform_admins` ADD `totpSecret` varchar(64);--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `totpEnabled` boolean DEFAULT false NOT NULL;