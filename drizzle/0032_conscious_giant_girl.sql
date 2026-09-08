CREATE TABLE `fiscal_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` enum('PENDING','AUTHORIZED','REJECTED','CANCELLED','CONTINGENCY','ERROR') NOT NULL DEFAULT 'PENDING',
	`environment` enum('HOMOLOGACAO','PRODUCAO') NOT NULL,
	`chaveAcesso` varchar(44),
	`numero` int,
	`serie` int,
	`protocoloAutorizacao` varchar(40),
	`xmlUrl` varchar(2048),
	`qrCodeUrl` varchar(2048),
	`danfeUrl` varchar(2048),
	`rejectionReason` text,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	`authorizedAt` bigint unsigned,
	CONSTRAINT `fiscal_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `fiscal_documents_order_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cnpj` varchar(14),
	`inscricaoEstadual` varchar(20),
	`regimeTributario` enum('SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL','MEI'),
	`environment` enum('HOMOLOGACAO','PRODUCAO') NOT NULL DEFAULT 'HOMOLOGACAO',
	`nfceSeries` int NOT NULL DEFAULT 1,
	`nfceNextNumber` int NOT NULL DEFAULT 1,
	`cscId` varchar(40),
	`cscTokenEncrypted` text,
	`certificateEncrypted` text,
	`certificatePasswordEncrypted` text,
	`certificateFilename` varchar(255),
	`certificateExpiresAt` bigint unsigned,
	`createdAt` bigint unsigned NOT NULL,
	`updatedAt` bigint unsigned NOT NULL,
	CONSTRAINT `fiscal_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `ncm` varchar(8);--> statement-breakpoint
CREATE INDEX `fiscal_documents_status_idx` ON `fiscal_documents` (`status`,`createdAt`);