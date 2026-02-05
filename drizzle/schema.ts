import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
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
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Workspaces - niche-based profiles for the user
 * Each workspace represents a different business/niche the user operates in
 * Example: "Digital Marketing", "Health & Fitness", "E-commerce"
 */
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  // User's niche description
  nicheDescription: text("nicheDescription"),
  // User's social media links for this workspace
  instagramUrl: text("instagramUrl"),
  tiktokUrl: text("tiktokUrl"),
  storeUrl: text("storeUrl"),
  otherUrl: text("otherUrl"),
  // Analyzed profile data from user's social links
  profileAnalysis: text("profileAnalysis"),
  // Products/services detected from user's profile
  productsDetected: text("productsDetected"),
  // Default reply mode for this workspace
  defaultReplyMode: mysqlEnum("defaultReplyMode", ["friend", "expert"]).default("friend"),
  // Is this the active workspace?
  isActive: boolean("isActive").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

/**
 * Prospects - buyer profiles saved within a workspace
 * Each prospect is like a WhatsApp contact with their profile info
 */
export const prospects = mysqlTable("prospects", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(),
  // Prospect's name
  name: varchar("name", { length: 256 }).notNull(),
  // Prospect's social media links
  instagramUrl: text("instagramUrl"),
  tiktokUrl: text("tiktokUrl"),
  storeUrl: text("storeUrl"),
  otherUrl: text("otherUrl"),
  // AI analysis of prospect's profile
  profileAnalysis: text("profileAnalysis"),
  // Detected interests/niche of prospect
  detectedInterests: text("detectedInterests"),
  // Suggested first message based on profile analysis
  suggestedFirstMessage: text("suggestedFirstMessage"),
  // Conversation stage
  conversationStage: mysqlEnum("conversationStage", [
    "first_contact",
    "warm_rapport", 
    "pain_discovery",
    "objection_resistance",
    "trust_reinforcement",
    "referral_to_expert",
    "expert_close"
  ]).default("first_contact"),
  // Reply mode for this prospect
  replyMode: mysqlEnum("replyMode", ["friend", "expert"]).default("friend"),
  // Outcome tracking
  outcome: mysqlEnum("outcome", ["active", "won", "lost", "ghosted"]).default("active"),
  outcomeNotes: text("outcomeNotes"),
  // Last message timestamp for sorting
  lastMessageAt: timestamp("lastMessageAt"),
  // Unread count
  unreadCount: int("unreadCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = typeof prospects.$inferInsert;

/**
 * Chat messages - WhatsApp-style conversation messages
 * Each message is either from the prospect (inbound) or a suggestion/response (outbound)
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  prospectId: int("prospectId").notNull(),
  userId: int("userId").notNull(),
  // Thread type: friend or expert (separate chat threads)
  threadType: mysqlEnum("threadType", ["friend", "expert"]).default("friend").notNull(),
  // Message direction: inbound (from prospect) or outbound (user's response)
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  // The message content
  content: text("content").notNull(),
  // If screenshot was uploaded, store the S3 URL
  screenshotUrl: text("screenshotUrl"),
  // For inbound: AI analysis of the message
  analysisContext: mysqlEnum("analysisContext", [
    "first_contact",
    "warm_rapport",
    "pain_discovery", 
    "objection_resistance",
    "trust_reinforcement",
    "referral_to_expert",
    "expert_close",
    "general"
  ]),
  // Detected tone/emotion of the prospect
  detectedTone: varchar("detectedTone", { length: 64 }),
  // AI reasoning for the analysis
  reasoning: text("reasoning"),
  // For outbound: was this an AI suggestion or user's own message?
  isAiSuggestion: boolean("isAiSuggestion").default(false),
  // For outbound: which suggestion type was used
  suggestionType: mysqlEnum("suggestionType", ["primary", "alternative", "soft", "custom"]),
  // Was the message actually sent by user?
  wasSent: boolean("wasSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * AI Suggestions - generated reply options for each inbound message
 */
export const aiSuggestions = mysqlTable("ai_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(), // Links to the inbound chat message
  prospectId: int("prospectId").notNull(),
  userId: int("userId").notNull(),
  // The suggested reply text
  suggestionText: text("suggestionText").notNull(),
  // Type of suggestion
  suggestionType: mysqlEnum("suggestionType", ["primary", "alternative", "soft"]).default("primary").notNull(),
  // Why this reply works - explanation for the user
  whyThisWorks: text("whyThisWorks"),
  // Warning if reply might sound pushy
  pushyWarning: text("pushyWarning"),
  // User feedback
  wasUsed: boolean("wasUsed").default(false),
  feedback: mysqlEnum("feedback", ["helpful", "not_helpful"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = typeof aiSuggestions.$inferInsert;

/**
 * Knowledge base items - stores references to uploaded URLs and PDFs
 * Enhanced for deep learning - stores comprehensive extracted knowledge
 */
export const knowledgeBaseItems = mysqlTable("knowledge_base_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId"), // Optional: can be global or workspace-specific
  // Type: url or pdf
  type: mysqlEnum("type", ["url", "pdf"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  // For URLs: the original URL; for PDFs: S3 URL
  sourceUrl: text("sourceUrl").notNull(),
  // Platform detected (youtube, instagram, tiktok, other)
  platform: varchar("platform", { length: 64 }),
  // DEEP LEARNING FIELDS
  // Full extracted/transcribed content
  fullContent: text("fullContent"),
  // Comprehensive summary of everything learned
  comprehensiveSummary: text("comprehensiveSummary"),
  // Sales psychology principles learned
  salesPsychology: text("salesPsychology"),
  // Rapport building techniques
  rapportTechniques: text("rapportTechniques"),
  // Conversation starters learned
  conversationStarters: text("conversationStarters"),
  // Objection handling frameworks
  objectionFrameworks: text("objectionFrameworks"),
  // Closing techniques
  closingTechniques: text("closingTechniques"),
  // Language patterns and phrases
  languagePatterns: text("languagePatterns"),
  // Emotional triggers and responses
  emotionalTriggers: text("emotionalTriggers"),
  // Trust building strategies
  trustStrategies: text("trustStrategies"),
  // Which brain to add to: friend, expert, or both
  brainType: mysqlEnum("brainType", ["friend", "expert", "both"]).default("both"),
  // Processing status
  status: mysqlEnum("status", ["pending", "processing", "ready", "failed"]).default("pending").notNull(),
  // Processing progress (0-100)
  processingProgress: int("processingProgress").default(0),
  // Error message if failed
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseItem = typeof knowledgeBaseItems.$inferSelect;
export type InsertKnowledgeBaseItem = typeof knowledgeBaseItems.$inferInsert;

// Legacy tables kept for migration compatibility
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }),
  buyerName: varchar("buyerName", { length: 256 }),
  replyMode: mysqlEnum("replyMode", ["friend", "expert"]).default("friend"),
  outcome: mysqlEnum("outcome", ["pending", "won", "lost"]).default("pending"),
  outcomeNotes: text("outcomeNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  inputText: text("inputText").notNull(),
  screenshotUrl: text("screenshotUrl"),
  analysisContext: mysqlEnum("analysisContext", ["objection", "tone_shift", "referral", "first_message", "follow_up", "general"]).default("general"),
  detectedTone: varchar("detectedTone", { length: 64 }),
  reasoning: text("reasoning"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

export const suggestions = mysqlTable("suggestions", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  messageId: int("messageId"),
  userId: int("userId").notNull(),
  suggestionText: text("suggestionText").notNull(),
  suggestionType: mysqlEnum("suggestionType", ["primary", "alternative", "expert_referral"]).default("primary").notNull(),
  tone: varchar("tone", { length: 64 }),
  wasUsed: mysqlEnum("wasUsed", ["yes", "no", "modified"]).default("no"),
  feedback: mysqlEnum("feedback", ["helpful", "not_helpful", "neutral"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = typeof suggestions.$inferInsert;

/**
 * Knowledge chunks - individual pieces of knowledge extracted from sources
 * Used for RAG retrieval when generating AI responses
 */
export const knowledgeChunks = mysqlTable("knowledge_chunks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceId: int("sourceId").notNull(), // Links to knowledgeBaseItems
  // Category of this knowledge chunk
  category: mysqlEnum("category", [
    "opening_lines",
    "rapport_building",
    "pain_discovery",
    "objection_handling",
    "trust_building",
    "closing_techniques",
    "psychology_insight",
    "language_pattern",
    "emotional_trigger",
    "general_wisdom"
  ]).notNull(),
  // The actual knowledge content
  content: text("content").notNull(),
  // Key phrases or triggers that should activate this knowledge
  triggerPhrases: text("triggerPhrases"),
  // Example usage scenario
  usageExample: text("usageExample"),
  // Relevance score (higher = more important)
  relevanceScore: int("relevanceScore").default(50),
  // Brain type: friend mode, expert mode, or both
  brainType: mysqlEnum("brainType", ["friend", "expert", "both"]).default("both"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

/**
 * AI Brain Stats - tracks the AI's learning progress
 */
export const aiBrainStats = mysqlTable("ai_brain_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Total sources processed
  totalSources: int("totalSources").default(0),
  // Total knowledge chunks extracted
  totalChunks: int("totalChunks").default(0),
  // Breakdown by category (JSON)
  categoryBreakdown: json("categoryBreakdown"),
  // Intelligence level (calculated based on knowledge)
  intelligenceLevel: int("intelligenceLevel").default(1),
  // Intelligence title
  intelligenceTitle: varchar("intelligenceTitle", { length: 64 }).default("Beginner"),
  // Last updated
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIBrainStats = typeof aiBrainStats.$inferSelect;
export type InsertAIBrainStats = typeof aiBrainStats.$inferInsert;
