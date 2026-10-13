CREATE TABLE `events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(140) NOT NULL,
  `description` varchar(1000),
  `imageUrl` varchar(500),
  `eventDate` varchar(60),
  `active` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` bigint unsigned NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
