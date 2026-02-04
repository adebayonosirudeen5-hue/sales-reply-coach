CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256),
	`inputText` text NOT NULL,
	`screenshotUrl` text,
	`analysisContext` enum('objection','tone_shift','referral','first_message','follow_up','general') DEFAULT 'general',
	`detectedTone` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('video','pdf') NOT NULL,
	`title` varchar(512) NOT NULL,
	`sourceUrl` text NOT NULL,
	`extractedContent` text,
	`status` enum('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_base_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`suggestionText` text NOT NULL,
	`suggestionType` enum('primary','alternative','expert_referral') NOT NULL DEFAULT 'primary',
	`tone` varchar(64),
	`wasUsed` enum('yes','no','modified') DEFAULT 'no',
	`feedback` enum('helpful','not_helpful','neutral'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `salesStyle` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `industry` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `productDescription` text;--> statement-breakpoint
ALTER TABLE `users` ADD `tonePreference` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `companyName` varchar(256);