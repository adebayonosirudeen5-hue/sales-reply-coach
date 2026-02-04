ALTER TABLE `conversations` ADD `buyerName` varchar(256);--> statement-breakpoint
ALTER TABLE `conversations` ADD `replyMode` enum('friend','expert') DEFAULT 'friend';--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD `learnedSummary` text;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD `objectionsHandled` text;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD `languageStyles` text;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD `brainType` enum('friend','expert','both') DEFAULT 'both';