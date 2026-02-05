CREATE TABLE `ai_brain_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalSources` int DEFAULT 0,
	`totalChunks` int DEFAULT 0,
	`categoryBreakdown` json,
	`intelligenceLevel` int DEFAULT 1,
	`intelligenceTitle` varchar(64) DEFAULT 'Beginner',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_brain_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_brain_stats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceId` int NOT NULL,
	`category` enum('opening_lines','rapport_building','pain_discovery','objection_handling','trust_building','closing_techniques','psychology_insight','language_pattern','emotional_trigger','general_wisdom') NOT NULL,
	`content` text NOT NULL,
	`triggerPhrases` text,
	`usageExample` text,
	`relevanceScore` int DEFAULT 50,
	`brainType` enum('friend','expert','both') DEFAULT 'both',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_chunks_id` PRIMARY KEY(`id`)
);
