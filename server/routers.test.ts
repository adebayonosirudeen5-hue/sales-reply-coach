import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  // Workspace functions
  getWorkspaces: vi.fn().mockResolvedValue([]),
  getActiveWorkspace: vi.fn().mockResolvedValue({ id: 1, name: "Test Workspace", isActive: true }),
  getWorkspace: vi.fn().mockResolvedValue({ id: 1, name: "Test Workspace" }),
  createWorkspace: vi.fn().mockResolvedValue(1),
  updateWorkspace: vi.fn().mockResolvedValue(undefined),
  deleteWorkspace: vi.fn().mockResolvedValue(undefined),
  setActiveWorkspace: vi.fn().mockResolvedValue(undefined),
  
  // Prospect functions
  getProspects: vi.fn().mockResolvedValue([]),
  getProspect: vi.fn().mockResolvedValue({ id: 1, name: "Test Prospect", workspaceId: 1 }),
  createProspect: vi.fn().mockResolvedValue(1),
  updateProspect: vi.fn().mockResolvedValue(undefined),
  deleteProspect: vi.fn().mockResolvedValue(undefined),
  getProspectStats: vi.fn().mockResolvedValue({
    total: 10,
    won: 5,
    lost: 3,
    ghosted: 1,
    active: 1,
    conversionRate: 62.5,
    friendMode: { total: 6, won: 3, conversionRate: 50 },
    expertMode: { total: 4, won: 2, conversionRate: 50 },
  }),
  
  // Chat message functions
  getChatMessages: vi.fn().mockResolvedValue([]),
  createChatMessage: vi.fn().mockResolvedValue(1),
  getConversationThread: vi.fn().mockResolvedValue(""),
  
  // AI suggestion functions
  createAiSuggestion: vi.fn().mockResolvedValue(1),
  getAiSuggestions: vi.fn().mockResolvedValue([]),
  markSuggestionUsed: vi.fn().mockResolvedValue(undefined),
  
  // Knowledge base functions
  getKnowledgeBaseItems: vi.fn().mockResolvedValue([]),
  getKnowledgeBaseItem: vi.fn().mockResolvedValue(null),
  createKnowledgeBaseItem: vi.fn().mockResolvedValue(1),
  updateKnowledgeBaseItem: vi.fn().mockResolvedValue(undefined),
  deleteKnowledgeBaseItem: vi.fn().mockResolvedValue(undefined),
  getReadyKnowledgeBaseContent: vi.fn().mockResolvedValue([]),
  getConversationContext: vi.fn().mockResolvedValue(""),
  updateAiSuggestionUsage: vi.fn().mockResolvedValue(undefined),
  
  // Knowledge chunk functions
  createKnowledgeChunk: vi.fn().mockResolvedValue(1),
  getKnowledgeChunks: vi.fn().mockResolvedValue([]),
  searchKnowledgeChunks: vi.fn().mockResolvedValue([]),
  deleteKnowledgeChunksBySource: vi.fn().mockResolvedValue(undefined),
  getBrainStats: vi.fn().mockResolvedValue({
    totalItems: 5,
    totalChunks: 50,
    byCategory: { opening_lines: 10, rapport_building: 15, objection_handling: 10, closing_techniques: 8, general: 7 },
    byBrain: { friend: 25, expert: 20, both: 5 },
    intelligenceLevel: 75,
  }),
  updateBrainStats: vi.fn().mockResolvedValue(undefined),
  getOrCreateBrainStats: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    totalSources: 2,
    totalChunks: 10,
    categoryBreakdown: {},
    intelligenceLevel: 50,
    intelligenceTitle: "Intermediate",
    updatedAt: new Date(),
  }),
}))

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/file.pdf", key: "test-key" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          conversationStage: "first_contact",
          detectedTone: "curious",
          primaryReply: "Thanks for reaching out! I'd love to hear more about what you're looking for.",
          alternativeReply: "Hey! Great to connect. What brings you here today?",
          softReply: "Hi there! Nice to meet you.",
          whyThisWorks: "This keeps it warm and open-ended.",
          pushyWarning: null,
          reasoning: "This is a first contact message."
        })
      }
    }]
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists workspaces for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    await caller.workspace.list();

    expect(db.getWorkspaces).toHaveBeenCalledWith(1);
  });

  it("gets active workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.workspace.getActive();

    expect(db.getActiveWorkspace).toHaveBeenCalledWith(1);
    expect(result?.name).toBe("Test Workspace");
  });

  it("creates a new workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.workspace.create({
      name: "Digital Marketing",
      nicheDescription: "Selling digital products",
      defaultReplyMode: "friend",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
    expect(db.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      name: "Digital Marketing",
      nicheDescription: "Selling digital products",
    }));
  });

  it("sets workspace as active", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.workspace.setActive({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.setActiveWorkspace).toHaveBeenCalledWith(1, 1);
  });

  it("deletes workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.workspace.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.deleteWorkspace).toHaveBeenCalledWith(1, 1);
  });
});

describe("prospect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists prospects for a workspace", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    await caller.prospect.list({ workspaceId: 1 });

    expect(db.getProspects).toHaveBeenCalledWith(1, 1);
  });

  it("creates a new prospect", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.prospect.create({
      workspaceId: 1,
      name: "John Doe",
      instagramUrl: "https://instagram.com/johndoe",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
    expect(db.createProspect).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      workspaceId: 1,
      name: "John Doe",
    }));
  });

  it("gets prospect stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.getStats({ workspaceId: 1 });

    expect(result).toBeDefined();
    expect(result.total).toBe(10);
    expect(result.won).toBe(5);
    expect(result.conversionRate).toBe(62.5);
  });

  it("updates prospect outcome", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.prospect.updateOutcome({
      id: 1,
      outcome: "won",
    });

    expect(result.success).toBe(true);
    expect(db.updateProspect).toHaveBeenCalledWith(1, 1, expect.objectContaining({
      outcome: "won",
    }));
  });

  it("deletes prospect", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.prospect.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.deleteProspect).toHaveBeenCalledWith(1, 1);
  });
});

describe("chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets messages for a prospect", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    await caller.chat.getMessages({ prospectId: 1 });

    expect(db.getChatMessages).toHaveBeenCalledWith(1, 1);
  });

  it("sends inbound message and gets AI suggestions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chat.sendInbound({
      prospectId: 1,
      content: "Hey, I saw your post about the product. How much does it cost?",
      replyMode: "friend",
    });

    expect(result).toBeDefined();
    expect(result.messageId).toBe(1);
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions.length).toBe(3); // primary, alternative, soft
  });

  it("sends outbound message", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.chat.sendOutbound({
      prospectId: 1,
      content: "Thanks for reaching out!",
      suggestionId: 1,
      suggestionType: "primary",
    });

    expect(result.success).toBe(true);
    expect(db.createChatMessage).toHaveBeenCalled();
  });
});

describe("knowledgeBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists knowledge base items for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    await caller.knowledgeBase.list({});

    expect(db.getKnowledgeBaseItems).toHaveBeenCalledWith(1, undefined);
  });

  it("adds URL to knowledge base", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.knowledgeBase.addUrl({
      title: "Sales Training Video",
      url: "https://youtube.com/watch?v=abc123",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
    expect(result.platform).toBe("youtube");
    expect(db.createKnowledgeBaseItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: "url",
      title: "Sales Training Video",
      sourceUrl: "https://youtube.com/watch?v=abc123",
      platform: "youtube",
      status: "pending",
    }));
  });

  it("detects Instagram platform from URL", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.knowledgeBase.addUrl({
      title: "Instagram Sales Tips",
      url: "https://instagram.com/p/abc123",
    });

    expect(result.platform).toBe("instagram");
    expect(db.createKnowledgeBaseItem).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "instagram",
      })
    );
  });

  it("validates URL format", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.knowledgeBase.addUrl({
        title: "Test",
        url: "not-a-valid-url",
      })
    ).rejects.toThrow();
  });

  it("deletes knowledge base item", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.knowledgeBase.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.deleteKnowledgeBaseItem).toHaveBeenCalledWith(1, 1);
  });
});
