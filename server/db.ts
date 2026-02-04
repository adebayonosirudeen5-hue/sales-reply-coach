import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  knowledgeBaseItems, 
  InsertKnowledgeBaseItem,
  conversations,
  InsertConversation,
  suggestions,
  InsertSuggestion
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, profile: {
  salesStyle?: string | null;
  industry?: string | null;
  productDescription?: string | null;
  tonePreference?: string | null;
  companyName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(profile).where(eq(users.id, userId));
}

// ============ KNOWLEDGE BASE QUERIES ============

export async function createKnowledgeBaseItem(item: InsertKnowledgeBaseItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(knowledgeBaseItems).values(item);
  return result[0].insertId;
}

export async function getKnowledgeBaseItems(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(knowledgeBaseItems)
    .where(eq(knowledgeBaseItems.userId, userId))
    .orderBy(desc(knowledgeBaseItems.createdAt));
}

export async function getKnowledgeBaseItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(knowledgeBaseItems)
    .where(and(eq(knowledgeBaseItems.id, id), eq(knowledgeBaseItems.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateKnowledgeBaseItem(id: number, userId: number, updates: {
  extractedContent?: string | null;
  status?: "pending" | "processing" | "ready" | "failed";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(knowledgeBaseItems)
    .set(updates)
    .where(and(eq(knowledgeBaseItems.id, id), eq(knowledgeBaseItems.userId, userId)));
}

export async function deleteKnowledgeBaseItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(knowledgeBaseItems)
    .where(and(eq(knowledgeBaseItems.id, id), eq(knowledgeBaseItems.userId, userId)));
}

export async function getReadyKnowledgeBaseContent(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select({
    id: knowledgeBaseItems.id,
    type: knowledgeBaseItems.type,
    title: knowledgeBaseItems.title,
    extractedContent: knowledgeBaseItems.extractedContent,
  }).from(knowledgeBaseItems)
    .where(and(
      eq(knowledgeBaseItems.userId, userId),
      eq(knowledgeBaseItems.status, "ready")
    ));
}

// ============ CONVERSATION QUERIES ============

export async function createConversation(conv: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(conversations).values(conv);
  return result[0].insertId;
}

export async function getConversations(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(limit);
}

export async function getConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateConversation(id: number, userId: number, updates: {
  title?: string | null;
  analysisContext?: "objection" | "tone_shift" | "referral" | "first_message" | "follow_up" | "general";
  detectedTone?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(conversations)
    .set(updates)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated suggestions first
  await db.delete(suggestions)
    .where(and(eq(suggestions.conversationId, id), eq(suggestions.userId, userId)));
  
  await db.delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

// ============ SUGGESTION QUERIES ============

export async function createSuggestion(sug: InsertSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(suggestions).values(sug);
  return result[0].insertId;
}

export async function getSuggestionsForConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(suggestions)
    .where(and(
      eq(suggestions.conversationId, conversationId),
      eq(suggestions.userId, userId)
    ))
    .orderBy(suggestions.createdAt);
}

export async function updateSuggestionUsage(id: number, userId: number, wasUsed: "yes" | "no" | "modified") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(suggestions)
    .set({ wasUsed })
    .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)));
}

export async function updateSuggestionFeedback(id: number, userId: number, feedback: "helpful" | "not_helpful" | "neutral") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(suggestions)
    .set({ feedback })
    .where(and(eq(suggestions.id, id), eq(suggestions.userId, userId)));
}
