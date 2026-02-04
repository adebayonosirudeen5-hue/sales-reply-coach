import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  knowledgeBaseItems, 
  InsertKnowledgeBaseItem,
  workspaces,
  InsertWorkspace,
  prospects,
  InsertProspect,
  chatMessages,
  InsertChatMessage,
  aiSuggestions,
  InsertAiSuggestion,
  // Legacy tables
  conversations,
  InsertConversation,
  conversationMessages,
  InsertConversationMessage,
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

// ============ WORKSPACE QUERIES ============

export async function createWorkspace(workspace: InsertWorkspace) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workspaces).values(workspace);
  return result[0].insertId;
}

export async function getWorkspaces(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(desc(workspaces.createdAt));
}

export async function getWorkspace(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getActiveWorkspace(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isActive, true)))
    .limit(1);
  
  // If no active workspace, return the first one
  if (!result[0]) {
    const firstWorkspace = await db.select().from(workspaces)
      .where(eq(workspaces.userId, userId))
      .orderBy(workspaces.createdAt)
      .limit(1);
    return firstWorkspace[0] ?? null;
  }
  return result[0];
}

export async function updateWorkspace(id: number, userId: number, updates: Partial<InsertWorkspace>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(workspaces)
    .set(updates)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
}

export async function setActiveWorkspace(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // First, deactivate all workspaces for this user
  await db.update(workspaces)
    .set({ isActive: false })
    .where(eq(workspaces.userId, userId));
  
  // Then activate the selected one
  await db.update(workspaces)
    .set({ isActive: true })
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
}

export async function deleteWorkspace(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated prospects and their messages first
  const workspaceProspects = await db.select({ id: prospects.id }).from(prospects)
    .where(eq(prospects.workspaceId, id));
  
  for (const prospect of workspaceProspects) {
    await db.delete(chatMessages).where(eq(chatMessages.prospectId, prospect.id));
    await db.delete(aiSuggestions).where(eq(aiSuggestions.prospectId, prospect.id));
  }
  
  await db.delete(prospects).where(eq(prospects.workspaceId, id));
  await db.delete(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
}

// ============ PROSPECT QUERIES ============

export async function createProspect(prospect: InsertProspect) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(prospects).values(prospect);
  return result[0].insertId;
}

export async function getProspects(workspaceId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(prospects)
    .where(and(eq(prospects.workspaceId, workspaceId), eq(prospects.userId, userId)))
    .orderBy(desc(prospects.lastMessageAt), desc(prospects.createdAt));
}

export async function getProspect(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(prospects)
    .where(and(eq(prospects.id, id), eq(prospects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateProspect(id: number, userId: number, updates: Partial<InsertProspect>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(prospects)
    .set(updates)
    .where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
}

export async function deleteProspect(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated messages and suggestions
  await db.delete(chatMessages).where(eq(chatMessages.prospectId, id));
  await db.delete(aiSuggestions).where(eq(aiSuggestions.prospectId, id));
  
  await db.delete(prospects)
    .where(and(eq(prospects.id, id), eq(prospects.userId, userId)));
}

// ============ CHAT MESSAGE QUERIES ============

export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(chatMessages).values(message);
  
  // Update prospect's lastMessageAt
  await db.update(prospects)
    .set({ lastMessageAt: new Date() })
    .where(eq(prospects.id, message.prospectId));
  
  return result[0].insertId;
}

export async function getChatMessages(prospectId: number, userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(chatMessages)
    .where(and(eq(chatMessages.prospectId, prospectId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

export async function getChatMessage(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.id, id), eq(chatMessages.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getConversationContext(prospectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all messages to build full conversation context
  const messages = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.prospectId, prospectId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt);

  return messages.map(m => {
    const prefix = m.direction === 'inbound' ? 'Prospect' : 'You';
    return `${prefix}: ${m.content}`;
  }).join("\n\n");
}

// ============ AI SUGGESTION QUERIES ============

export async function createAiSuggestion(suggestion: InsertAiSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(aiSuggestions).values(suggestion);
  return result[0].insertId;
}

export async function getAiSuggestions(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(aiSuggestions)
    .where(and(eq(aiSuggestions.messageId, messageId), eq(aiSuggestions.userId, userId)))
    .orderBy(aiSuggestions.createdAt);
}

export async function updateAiSuggestionUsage(id: number, userId: number, wasUsed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(aiSuggestions)
    .set({ wasUsed })
    .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.userId, userId)));
}

export async function updateAiSuggestionFeedback(id: number, userId: number, feedback: "helpful" | "not_helpful") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(aiSuggestions)
    .set({ feedback })
    .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.userId, userId)));
}

// ============ KNOWLEDGE BASE QUERIES ============

export async function createKnowledgeBaseItem(item: InsertKnowledgeBaseItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(knowledgeBaseItems).values(item);
  return result[0].insertId;
}

export async function getKnowledgeBaseItems(userId: number, workspaceId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (workspaceId) {
    return db.select().from(knowledgeBaseItems)
      .where(and(
        eq(knowledgeBaseItems.userId, userId),
        eq(knowledgeBaseItems.workspaceId, workspaceId)
      ))
      .orderBy(desc(knowledgeBaseItems.createdAt));
  }

  // Get global items (no workspace) and workspace-specific items
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

export async function updateKnowledgeBaseItem(id: number, userId: number, updates: Partial<InsertKnowledgeBaseItem>) {
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

export async function getReadyKnowledgeBaseContent(userId: number, brainType?: "friend" | "expert", workspaceId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db.select().from(knowledgeBaseItems)
    .where(and(
      eq(knowledgeBaseItems.userId, userId),
      eq(knowledgeBaseItems.status, "ready")
    ));
  
  let filtered = results;
  
  // Filter by workspace if provided (include global items too)
  if (workspaceId) {
    filtered = filtered.filter(item => 
      item.workspaceId === workspaceId || item.workspaceId === null
    );
  }
  
  // Filter by brain type
  if (brainType) {
    filtered = filtered.filter(item => 
      item.brainType === brainType || item.brainType === "both"
    );
  }
  
  return filtered;
}

// ============ ANALYTICS QUERIES ============

export async function getProspectStats(userId: number, workspaceId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let allProspects;
  if (workspaceId) {
    allProspects = await db.select().from(prospects)
      .where(and(eq(prospects.userId, userId), eq(prospects.workspaceId, workspaceId)));
  } else {
    allProspects = await db.select().from(prospects)
      .where(eq(prospects.userId, userId));
  }

  const total = allProspects.length;
  const active = allProspects.filter(p => p.outcome === "active").length;
  const won = allProspects.filter(p => p.outcome === "won").length;
  const lost = allProspects.filter(p => p.outcome === "lost").length;
  const ghosted = allProspects.filter(p => p.outcome === "ghosted").length;

  // Stats by reply mode
  const friendProspects = allProspects.filter(p => p.replyMode === "friend");
  const expertProspects = allProspects.filter(p => p.replyMode === "expert");

  const friendWon = friendProspects.filter(p => p.outcome === "won").length;
  const friendClosed = friendProspects.filter(p => p.outcome !== "active").length;
  const expertWon = expertProspects.filter(p => p.outcome === "won").length;
  const expertClosed = expertProspects.filter(p => p.outcome !== "active").length;

  return {
    total,
    active,
    won,
    lost,
    ghosted,
    conversionRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    friendMode: {
      total: friendProspects.length,
      won: friendWon,
      conversionRate: friendClosed > 0 ? Math.round((friendWon / friendClosed) * 100) : 0,
    },
    expertMode: {
      total: expertProspects.length,
      won: expertWon,
      conversionRate: expertClosed > 0 ? Math.round((expertWon / expertClosed) * 100) : 0,
    },
  };
}

// ============ LEGACY QUERIES (for backward compatibility) ============

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
