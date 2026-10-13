CREATE TABLE `payment_gateways` (
  `id` int AUTO_INCREMENT NOT NULL,
  `provider` enum('MERCADO_PAGO','PAGSEGURO','STRIPE','CIELO','REDE','GETNET','PAYPAL','OUTRO') NOT NULL,
  `label` varchar(120) NOT NULL,
  `apiKey` varchar(500),
  `secretKey` varchar(500),
  `extra` varchar(1000),
  `active` boolean NOT NULL DEFAULT false,
  `createdAt` bigint unsigned NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  CONSTRAINT `payment_gateways_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `paymentMethod` enum('PIX','CASH','CARD_ON_DELIVERY','CARD_ONLINE') NOT NULL;
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `method` enum('PIX','CASH','CARD_ON_DELIVERY','CARD_ONLINE') NOT NULL;
