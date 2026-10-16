ALTER TABLE `platform_admins` ADD `securityEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `securityFriendHash` varchar(255);--> statement-breakpoint
ALTER TABLE `platform_admins` ADD `securityPinHash` varchar(255);