import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  getKnowledgeBaseItems: vi.fn().mockResolvedValue([]),
  createKnowledgeBaseItem: vi.fn().mockResolvedValue(1),
  getKnowledgeBaseItem: vi.fn().mockResolvedValue(null),
  updateKnowledgeBaseItem: vi.fn().mockResolvedValue(undefined),
  deleteKnowledgeBaseItem: vi.fn().mockResolvedValue(undefined),
  getReadyKnowledgeBaseContent: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue(1),
  getConversations: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn().mockResolvedValue(null),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  createSuggestion: vi.fn().mockResolvedValue(1),
  getSuggestionsForConversation: vi.fn().mockResolvedValue([]),
  updateSuggestionUsage: vi.fn().mockResolvedValue(undefined),
  updateSuggestionFeedback: vi.fn().mockResolvedValue(undefined),
}));

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
          contextType: "general",
          detectedTone: "curious",
          primaryReply: "Thanks for reaching out! I'd love to hear more about what you're looking for.",
          alternativeReply: "Hey! Great to connect. What brings you here today?",
          expertReferral: null,
          reasoning: "This is a first contact message, so we keep it warm and open-ended."
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
    salesStyle: "consultative",
    industry: "tech",
    productDescription: "SaaS product",
    tonePreference: "professional",
    companyName: "Test Co",
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

describe("profile", () => {
  it("returns profile data for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.get();

    expect(result).toBeDefined();
    expect(result.salesStyle).toBe("consultative");
    expect(result.industry).toBe("tech");
    expect(result.tonePreference).toBe("professional");
  });

  it("updates profile successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.profile.update({
      salesStyle: "friendly",
      industry: "health",
      tonePreference: "warm",
    });

    expect(result.success).toBe(true);
    expect(db.updateUserProfile).toHaveBeenCalledWith(1, {
      salesStyle: "friendly",
      industry: "health",
      tonePreference: "warm",
    });
  });

  it("rejects profile update for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profile.update({ salesStyle: "friendly" })
    ).rejects.toThrow();
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

    await caller.knowledgeBase.list();

    expect(db.getKnowledgeBaseItems).toHaveBeenCalledWith(1);
  });

  it("adds video URL to knowledge base", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.knowledgeBase.addVideo({
      title: "Sales Training Video",
      url: "https://youtube.com/watch?v=abc123",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(1);
    expect(db.createKnowledgeBaseItem).toHaveBeenCalledWith({
      userId: 1,
      type: "video",
      title: "Sales Training Video",
      sourceUrl: "https://youtube.com/watch?v=abc123",
      status: "pending",
    });
  });

  it("validates video URL format", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.knowledgeBase.addVideo({
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

describe("conversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists conversations for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    await caller.conversation.list();

    expect(db.getConversations).toHaveBeenCalledWith(1);
  });

  it("analyzes conversation and returns suggestions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversation.analyze({
      inputText: "Hey, I saw your post about the product. How much does it cost?",
    });

    expect(result).toBeDefined();
    expect(result.conversationId).toBe(1);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.contextType).toBe("general");
    expect(result.suggestions).toHaveLength(2); // primary + alternative
    expect(result.suggestions[0].type).toBe("primary");
  });

  it("requires input text for analysis", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.conversation.analyze({ inputText: "" })
    ).rejects.toThrow();
  });

  it("deletes conversation and associated suggestions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.conversation.delete({ id: 1 });

    expect(result.success).toBe(true);
    expect(db.deleteConversation).toHaveBeenCalledWith(1, 1);
  });
});

describe("suggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks suggestion as used", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.suggestion.markUsed({
      id: 1,
      wasUsed: "yes",
    });

    expect(result.success).toBe(true);
    expect(db.updateSuggestionUsage).toHaveBeenCalledWith(1, 1, "yes");
  });

  it("records suggestion feedback", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");

    const result = await caller.suggestion.feedback({
      id: 1,
      feedback: "helpful",
    });

    expect(result.success).toBe(true);
    expect(db.updateSuggestionFeedback).toHaveBeenCalledWith(1, 1, "helpful");
  });

  it("validates feedback values", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.suggestion.feedback({
        id: 1,
        feedback: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});
