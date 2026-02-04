import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with profile fields for sales personalization.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // Profile fields for personalization
  salesStyle: varchar("salesStyle", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  productDescription: text("productDescription"),
  tonePreference: varchar("tonePreference", { length: 64 }),
  companyName: varchar("companyName", { length: 256 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Knowledge base items - stores references to uploaded URLs and PDFs
 * that form the user's personalized "brain" for generating suggestions.
 */
export const knowledgeBaseItems = mysqlTable("knowledge_base_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Type: url (YouTube, Instagram, etc.) or pdf
  type: mysqlEnum("type", ["video", "pdf", "url"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  // For URLs: the original URL; for PDFs: S3 URL
  sourceUrl: text("sourceUrl").notNull(),
  // Platform detected (youtube, instagram, tiktok, other)
  platform: varchar("platform", { length: 64 }),
  // Extracted/transcribed content for AI context
  extractedContent: text("extractedContent"),
  // "What I Learned" summary - extracted principles, objection frameworks, language patterns
  learnedSummary: text("learnedSummary"),
  // Detected objections this content helps handle
  objectionsHandled: text("objectionsHandled"),
  // Language styles detected in the content
  languageStyles: text("languageStyles"),
  // Which brain to add to: friend, expert, or both
  brainType: mysqlEnum("brainType", ["friend", "expert", "both"]).default("both"),
  // Processing status
  status: mysqlEnum("status", ["pending", "processing", "ready", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseItem = typeof knowledgeBaseItems.$inferSelect;
export type InsertKnowledgeBaseItem = typeof knowledgeBaseItems.$inferInsert;

/**
 * Conversations - stores conversation analysis sessions (threads)
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }),
  // Buyer/prospect name for tagging
  buyerName: varchar("buyerName", { length: 256 }),
  // Reply mode used: friend or expert
  replyMode: mysqlEnum("replyMode", ["friend", "expert"]).default("friend"),
  // Success tracking: outcome of the conversation
  outcome: mysqlEnum("outcome", ["pending", "won", "lost"]).default("pending"),
  // Notes about the outcome
  outcomeNotes: text("outcomeNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Conversation messages - individual messages within a conversation thread
 */
export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  // The input text for this message
  inputText: text("inputText").notNull(),
  // If screenshot was uploaded, store the S3 URL
  screenshotUrl: text("screenshotUrl"),
  // AI analysis of the conversation context
  analysisContext: mysqlEnum("analysisContext", ["objection", "tone_shift", "referral", "first_message", "follow_up", "general"]).default("general"),
  // Detected tone of the prospect
  detectedTone: varchar("detectedTone", { length: 64 }),
  // AI reasoning for the suggestions
  reasoning: text("reasoning"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

/**
 * Suggestions - stores AI-generated reply suggestions for each message
 */
export const suggestions = mysqlTable("suggestions", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  messageId: int("messageId"), // Links to specific message in thread
  userId: int("userId").notNull(),
  // The suggested reply text
  suggestionText: text("suggestionText").notNull(),
  // Type of suggestion
  suggestionType: mysqlEnum("suggestionType", ["primary", "alternative", "expert_referral"]).default("primary").notNull(),
  // Tone of the suggestion
  tone: varchar("tone", { length: 64 }),
  // Whether the user used this suggestion
  wasUsed: mysqlEnum("wasUsed", ["yes", "no", "modified"]).default("no"),
  // User feedback on the suggestion
  feedback: mysqlEnum("feedback", ["helpful", "not_helpful", "neutral"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = typeof suggestions.$inferInsert;
