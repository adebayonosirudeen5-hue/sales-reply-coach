CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`inputText` text NOT NULL,
	`screenshotUrl` text,
	`analysisContext` enum('objection','tone_shift','referral','first_message','follow_up','general') DEFAULT 'general',
	`detectedTone` varchar(64),
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `knowledge_base_items` MODIFY COLUMN `type` enum('video','pdf','url') NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `outcome` enum('pending','won','lost') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `conversations` ADD `outcomeNotes` text;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD `platform` varchar(64);--> statement-breakpoint
ALTER TABLE `suggestions` ADD `messageId` int;--> statement-breakpoint
ALTER TABLE `conversations` DROP COLUMN `inputText`;--> statement-breakpoint
ALTER TABLE `conversations` DROP COLUMN `screenshotUrl`;--> statement-breakpoint
ALTER TABLE `conversations` DROP COLUMN `analysisContext`;--> statement-breakpoint
ALTER TABLE `conversations` DROP COLUMN `detectedTone`;