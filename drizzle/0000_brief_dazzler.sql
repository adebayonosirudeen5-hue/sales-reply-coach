CREATE TABLE `ai_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`prospectId` int NOT NULL,
	`userId` int NOT NULL,
	`suggestionText` text NOT NULL,
	`suggestionType` enum('primary','alternative','soft') NOT NULL DEFAULT 'primary',
	`whyThisWorks` text,
	`pushyWarning` text,
	`wasUsed` boolean DEFAULT false,
	`feedback` enum('helpful','not_helpful'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectId` int NOT NULL,
	`userId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`content` text NOT NULL,
	`screenshotUrl` text,
	`analysisContext` enum('first_contact','warm_rapport','pain_discovery','objection_resistance','trust_reinforcement','referral_to_expert','expert_close','general'),
	`detectedTone` varchar(64),
	`reasoning` text,
	`isAiSuggestion` boolean DEFAULT false,
	`suggestionType` enum('primary','alternative','soft','custom'),
	`wasSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256),
	`buyerName` varchar(256),
	`replyMode` enum('friend','expert') DEFAULT 'friend',
	`outcome` enum('pending','won','lost') DEFAULT 'pending',
	`outcomeNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int,
	`type` enum('url','pdf') NOT NULL,
	`title` varchar(512) NOT NULL,
	`sourceUrl` text NOT NULL,
	`platform` varchar(64),
	`fullContent` text,
	`comprehensiveSummary` text,
	`salesPsychology` text,
	`rapportTechniques` text,
	`conversationStarters` text,
	`objectionFrameworks` text,
	`closingTechniques` text,
	`languagePatterns` text,
	`emotionalTriggers` text,
	`trustStrategies` text,
	`brainType` enum('friend','expert','both') DEFAULT 'both',
	`status` enum('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
	`processingProgress` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_base_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`instagramUrl` text,
	`tiktokUrl` text,
	`storeUrl` text,
	`otherUrl` text,
	`profileAnalysis` text,
	`detectedInterests` text,
	`suggestedFirstMessage` text,
	`conversationStage` enum('first_contact','warm_rapport','pain_discovery','objection_resistance','trust_reinforcement','referral_to_expert','expert_close') DEFAULT 'first_contact',
	`replyMode` enum('friend','expert') DEFAULT 'friend',
	`outcome` enum('active','won','lost','ghosted') DEFAULT 'active',
	`outcomeNotes` text,
	`lastMessageAt` timestamp,
	`unreadCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prospects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` int,
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`nicheDescription` text,
	`instagramUrl` text,
	`tiktokUrl` text,
	`storeUrl` text,
	`otherUrl` text,
	`profileAnalysis` text,
	`productsDetected` text,
	`defaultReplyMode` enum('friend','expert') DEFAULT 'friend',
	`isActive` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
