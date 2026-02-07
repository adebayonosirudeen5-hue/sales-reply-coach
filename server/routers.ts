import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";

// Helper to detect platform from URL
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "youtube";
  if (urlLower.includes("instagram.com")) return "instagram";
  if (urlLower.includes("tiktok.com")) return "tiktok";
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) return "facebook";
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "twitter";
  if (urlLower.includes("linkedin.com")) return "linkedin";
  return "other";
}

// Friend mode behavior rules from the spec
const FRIEND_MODE_INSTRUCTIONS = `ROLE & IDENTITY:
You are a friendly, relatable peer who speaks like a real person texting a friend.
Background: You were once stuck, confused, overwhelmed, and skeptical about online income. You tried things that didn't work. You eventually found clarity and consistency.
Current status: You are now successful and stable. You are calm, confident, and not desperate. You never chase or convince.

COMMUNICATION RULES:
- Sound human, casual, warm, and supportive
- Never use hype language
- Never say "buy", "offer", or "program" unless the other person asks
- Share personal experience naturally
- End most replies with a genuine question
- Your goal is to understand the person and make sure they convert to expert side

AUDIENCE AWARENESS:
Assume the person may be: a stay-at-home mum, a 9-5 worker, a beginner in digital marketing, someone burned before, or from another industry.
Always listen first, mirror their words, and respond emotionally before logically.

PAIN & EMOTION MIRRORING:
When someone shares confusion, doubt, fear, or frustration:
1. Acknowledge the emotion
2. Share a short personal moment where you felt the same
3. Normalize their experience
4. Ask a soft follow-up question

"WHAT DID YOU USE?" RESPONSE LOGIC:
When the user asks any variation of "What did you use?" or "How did you do it?":
1. NEVER immediately recommend a tool, funnel, or person
2. First, ask a grounding question to understand their situation
3. After they answer, reflect their situation back to them
4. Share your turning point (story, not pitch)
5. Only then may you mention a structured solution (permission-based)
6. End by inviting their decision, not pushing yours`;

const EXPERT_MODE_INSTRUCTIONS = `ROLE & IDENTITY:
You are a knowledgeable professional who provides clear, direct guidance.
You speak with authority and confidence, backed by expertise.
You focus on solutions and value, not just rapport.

COMMUNICATION RULES:
- You can discuss products, services, and offers directly when relevant
- You provide structured, actionable advice
- You maintain professionalism while still being personable
- You can recommend specific next steps and resources
- Be direct but not pushy
- Focus on value and outcomes`;

// Helper function to call LLM with retry logic
async function callLLMWithRetry(params: Parameters<typeof invokeLLM>[0], maxRetries = 2): Promise<ReturnType<typeof invokeLLM>> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await invokeLLM(params);
      if (!result || !result.choices || !Array.isArray(result.choices)) {
        throw new Error("Invalid response structure from AI service");
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message;
      
      if (errorMsg.includes("<html") || errorMsg.includes("<!DOCTYPE") || errorMsg.includes("not valid JSON")) {
        console.error(`LLM service unavailable (attempt ${attempt + 1}):`, "Service returned HTML error page");
        lastError = new Error("AI service is temporarily unavailable. Please try again in a few minutes.");
      } else {
        console.error(`LLM call attempt ${attempt + 1} failed:`, errorMsg);
      }
      
      if (attempt < maxRetries) {
        const waitTime = 2000 * Math.pow(2, attempt);
        console.log(`Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  throw lastError || new Error("AI service failed after multiple retries. Please try again later.");
}

// Map conversation context to knowledge categories
function getRelevantCategories(contextType: string): string[] {
  const categoryMap: Record<string, string[]> = {
    "first_contact": ["opening_lines", "rapport_building", "psychology_insight"],
    "warm_rapport": ["rapport_building", "pain_discovery", "language_pattern"],
    "pain_discovery": ["pain_discovery", "emotional_trigger", "psychology_insight"],
    "objection_resistance": ["objection_handling", "trust_building", "psychology_insight"],
    "trust_reinforcement": ["trust_building", "language_pattern", "psychology_insight"],
    "referral_to_expert": ["closing_techniques", "trust_building"],
    "expert_close": ["closing_techniques", "objection_handling", "psychology_insight"],
    "general": ["general_wisdom", "language_pattern", "psychology_insight"],
  };
  return categoryMap[contextType] || categoryMap["general"];
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ AI BRAIN STATS ============
  brain: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrCreateBrainStats(ctx.user.id);
    }),

    getChunks: protectedProcedure
      .input(z.object({ 
        category: z.string().optional(),
        brainType: z.enum(["friend", "expert"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        return db.getKnowledgeChunks(ctx.user.id, input.category, input.brainType);
      }),

    getChunksBySource: protectedProcedure
      .input(z.object({ sourceId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getKnowledgeChunksBySource(input.sourceId, ctx.user.id);
      }),
  }),

  // ============ WORKSPACE MANAGEMENT ============
  workspace: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getWorkspaces(ctx.user.id);
    }),

    getActive: protectedProcedure.query(async ({ ctx }) => {
      return db.getActiveWorkspace(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getWorkspace(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        nicheDescription: z.string().optional(),
        instagramUrl: z.string().optional(),
        tiktokUrl: z.string().optional(),
        storeUrl: z.string().optional(),
        otherUrl: z.string().optional(),
        defaultReplyMode: z.enum(["friend", "expert"]).default("friend"),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createWorkspace({
          userId: ctx.user.id,
          ...input,
          isActive: true,
        });
        await db.setActiveWorkspace(id, ctx.user.id);
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nicheDescription: z.string().optional(),
        instagramUrl: z.string().optional(),
        tiktokUrl: z.string().optional(),
        storeUrl: z.string().optional(),
        otherUrl: z.string().optional(),
        defaultReplyMode: z.enum(["friend", "expert"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateWorkspace(id, ctx.user.id, updates);
        return { success: true };
      }),

    setActive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.setActiveWorkspace(input.id, ctx.user.id);
        return { success: true };
      }),

    analyzeProfile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspace(input.id, ctx.user.id);
        if (!workspace) throw new Error("Workspace not found");

        const urls = [workspace.instagramUrl, workspace.tiktokUrl, workspace.storeUrl, workspace.otherUrl].filter(Boolean);

        if (urls.length === 0 && !workspace.nicheDescription) {
          throw new Error("Please add at least one social URL or niche description");
        }

        const response = await callLLMWithRetry({
          messages: [
            { role: "system", content: "You are a business profile analyzer. Analyze the provided information to understand what products/services this person offers and their target audience." },
            { role: "user", content: `Analyze this business profile:
Niche Description: ${workspace.nicheDescription || "Not provided"}
Instagram: ${workspace.instagramUrl || "Not provided"}
TikTok: ${workspace.tiktokUrl || "Not provided"}
Store: ${workspace.storeUrl || "Not provided"}
Other: ${workspace.otherUrl || "Not provided"}

Provide a JSON response with:
1. profileAnalysis: Summary of what this person does/sells
2. productsDetected: List of products/services detected` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "profile_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  profileAnalysis: { type: "string" },
                  productsDetected: { type: "string" },
                },
                required: ["profileAnalysis", "productsDetected"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const analysis = JSON.parse(typeof content === 'string' ? content : '{}');

        await db.updateWorkspace(input.id, ctx.user.id, {
          profileAnalysis: analysis.profileAnalysis,
          productsDetected: analysis.productsDetected,
        });

        return { success: true, ...analysis };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteWorkspace(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ PROSPECT MANAGEMENT ============
  prospect: router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getProspects(input.workspaceId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        threadType: z.enum(["friend", "expert"]).optional().default("friend"),
      }))
      .query(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.id, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");
        const messages = await db.getChatMessages(input.id, ctx.user.id, input.threadType);
        return { prospect, messages };
      }),

    create: protectedProcedure
      .input(z.object({
        workspaceId: z.number(),
        name: z.string().min(1),
        instagramUrl: z.string().optional(),
        tiktokUrl: z.string().optional(),
        storeUrl: z.string().optional(),
        otherUrl: z.string().optional(),
        importedConversation: z.string().optional(),
        isReEngagement: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProspect({
          workspaceId: input.workspaceId,
          name: input.name,
          instagramUrl: input.instagramUrl,
          tiktokUrl: input.tiktokUrl,
          storeUrl: input.storeUrl,
          otherUrl: input.otherUrl,
          userId: ctx.user.id,
          conversationStage: input.isReEngagement ? "warm_rapport" : "first_contact",
        });

        // If conversation was imported, analyze it and create initial message
        if (input.importedConversation) {
          // Store the imported conversation as the first message
          await db.createChatMessage({
            prospectId: id,
            userId: ctx.user.id,
            direction: "inbound",
            content: `[IMPORTED CONVERSATION]\n${input.importedConversation}`,
          });

          // Get workspace context
          const workspace = await db.getWorkspace(input.workspaceId, ctx.user.id);
          
          // Get relevant knowledge for re-engagement
          const knowledgeChunks = await db.searchKnowledgeChunks(
            ctx.user.id,
            ["re_engagement", "rapport_building", "trust_building"],
            "friend",
            5
          );

          // Analyze the conversation and generate re-engagement suggestion
          try {
            const response = await callLLMWithRetry({
              messages: [
                { role: "system", content: `You are a sales re-engagement expert. Analyze the imported conversation and suggest a re-engagement message.

IMPORTANT RULES:
- The prospect has seen previous messages but not replied
- Be warm, casual, and non-pushy
- Reference something from the conversation naturally
- Don't be desperate or needy
- Suggest 2-3 different approaches` },
                { role: "user", content: `Analyze this conversation and suggest re-engagement messages:

BUSINESS CONTEXT:
${workspace?.profileAnalysis || workspace?.nicheDescription || "Not specified"}

LEARNED KNOWLEDGE:
${knowledgeChunks.map(c => c.content).join("\n")}

IMPORTED CONVERSATION:
${input.importedConversation}

Provide 2-3 re-engagement message suggestions in JSON format:
{"suggestions": [{"type": "casual", "text": "...", "why": "..."}, ...], "analysis": {"lastTopic": "...", "prospectInterest": "...", "bestApproach": "..."}}` }
              ],
              response_format: { type: "json_object" }
            });

            const rawContent = response.choices[0]?.message?.content;
            const content = typeof rawContent === 'string' ? rawContent : '';
            if (content) {
              const analysis = JSON.parse(content);
              // Store the analysis as an outbound suggestion
              await db.createChatMessage({
                prospectId: id,
                userId: ctx.user.id,
                direction: "outbound",
                content: `[RE-ENGAGEMENT ANALYSIS]\n${JSON.stringify(analysis, null, 2)}`,
                isAiSuggestion: true,
              });
            }
          } catch (error) {
            console.error("Failed to analyze imported conversation:", error);
          }
        }

        return { id, success: true };
      }),

    analyzeProfile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.id, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        const urls = [prospect.instagramUrl, prospect.tiktokUrl, prospect.storeUrl, prospect.otherUrl].filter(Boolean);

        if (urls.length === 0) {
          throw new Error("Please add at least one social URL for this prospect");
        }

        const workspace = await db.getWorkspace(prospect.workspaceId, ctx.user.id);
        const workspaceContext = workspace ? `
Your Business: ${workspace.profileAnalysis || workspace.nicheDescription || "Not specified"}
Your Products: ${workspace.productsDetected || "Not specified"}` : "";

        // Get relevant knowledge for first contact
        const knowledgeChunks = await db.searchKnowledgeChunks(
          ctx.user.id,
          ["opening_lines", "rapport_building", "psychology_insight"],
          prospect.replyMode || "friend",
          5
        );
        const knowledgeContext = knowledgeChunks.length > 0
          ? `\n\nYOUR LEARNED KNOWLEDGE:\n${knowledgeChunks.map(c => `[${c.category}]: ${c.content}`).join("\n")}`
          : "";

        const response = await callLLMWithRetry({
          messages: [
            { role: "system", content: "You are a prospect analyzer. Analyze the prospect's profile and suggest a personalized first message." },
            { role: "user", content: `Analyze this prospect and suggest a first message:
${workspaceContext}

Prospect URLs:
${urls.join("\n")}
${knowledgeContext}

Provide a JSON response with:
1. profileAnalysis: What you learned about this prospect
2. detectedInterests: Their interests/niche
3. suggestedFirstMessage: A personalized first message that would get them to reply` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "prospect_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  profileAnalysis: { type: "string" },
                  detectedInterests: { type: "string" },
                  suggestedFirstMessage: { type: "string" },
                },
                required: ["profileAnalysis", "detectedInterests", "suggestedFirstMessage"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const analysis = JSON.parse(typeof content === 'string' ? content : '{}');

        await db.updateProspect(input.id, ctx.user.id, {
          profileAnalysis: analysis.profileAnalysis,
          detectedInterests: analysis.detectedInterests,
          suggestedFirstMessage: analysis.suggestedFirstMessage,
        });

        return { success: true, ...analysis };
      }),

    updateOutcome: protectedProcedure
      .input(z.object({
        id: z.number(),
        outcome: z.enum(["active", "won", "lost", "ghosted"]).optional(),
        outcomeNotes: z.string().optional(),
        replyMode: z.enum(["friend", "expert"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: Record<string, unknown> = {};
        if (input.outcome) updateData.outcome = input.outcome;
        if (input.outcomeNotes) updateData.outcomeNotes = input.outcomeNotes;
        if (input.replyMode) updateData.replyMode = input.replyMode;
        await db.updateProspect(input.id, ctx.user.id, updateData);

        // CONTINUOUS LEARNING: Extract patterns from won conversations
        if (input.outcome === "won") {
          const prospect = await db.getProspect(input.id, ctx.user.id);
          if (prospect) {
            // Get all messages from this conversation (both friend and expert threads)
            const friendMessages = await db.getChatMessages(input.id, ctx.user.id, "friend");
            const expertMessages = await db.getChatMessages(input.id, ctx.user.id, "expert");
            const allMessages = [...friendMessages, ...expertMessages];

            if (allMessages.length > 0) {
              const conversationText = allMessages
                .map(m => `${m.direction === "inbound" ? "Prospect" : "You"}: ${m.content}`)
                .join("\n");

              // Extract learning patterns using AI
              try {
                const learningResponse = await callLLMWithRetry({
                  messages: [
                    {
                      role: "system",
                      content: "You are a sales coach analyzing successful conversations to extract reusable patterns and strategies."
                    },
                    {
                      role: "user",
                      content: `Analyze this SUCCESSFUL sales conversation and extract 3-5 key patterns or strategies that led to success.

Conversation:
${conversationText}

Outcome Notes: ${input.outcomeNotes || "None"}

For each pattern, provide:
1. The specific technique or approach used
2. Why it worked
3. How to apply it in future conversations

Return as JSON array with fields: technique, why_it_worked, how_to_apply`
                    }
                  ],
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "learning_patterns",
                      strict: true,
                      schema: {
                        type: "object",
                        properties: {
                          patterns: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                technique: { type: "string" },
                                why_it_worked: { type: "string" },
                                how_to_apply: { type: "string" },
                              },
                              required: ["technique", "why_it_worked", "how_to_apply"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["patterns"],
                        additionalProperties: false,
                      },
                    },
                  },
                });

                const learningContent = learningResponse.choices[0]?.message?.content;
                const learning = JSON.parse(typeof learningContent === 'string' ? learningContent : '{}');

                // Store each pattern as a knowledge chunk
                if (learning.patterns && Array.isArray(learning.patterns)) {
                  for (let i = 0; i < learning.patterns.length; i++) {
                    const pattern = learning.patterns[i];
                    const chunkContent = `${pattern.technique}\n\nWhy it worked: ${pattern.why_it_worked}\n\nHow to apply: ${pattern.how_to_apply}`;
                    
                    await db.createKnowledgeChunk({
                      userId: ctx.user.id,
                      sourceId: 0, // No source, this is from conversation learning
                      category: "general_wisdom",
                      content: chunkContent,
                      brainType: "both",
                      triggerPhrases: pattern.technique,
                      relevanceScore: 80, // High relevance for learned patterns
                    });
                  }

                  // Update brain stats
                  await db.updateBrainStats(ctx.user.id);
                }
              } catch (error) {
                console.error("[Learning] Failed to extract patterns:", error);
                // Don't fail the outcome update if learning extraction fails
              }
            }
          }
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProspect(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ CHAT (WhatsApp-style) ============
  chat: router({
    getMessages: protectedProcedure
      .input(z.object({ 
        prospectId: z.number(),
        threadType: z.enum(["friend", "expert"]).optional().default("friend"),
      }))
      .query(async ({ ctx, input }) => {
        return db.getChatMessages(input.prospectId, ctx.user.id, input.threadType);
      }),

    uploadScreenshot: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const fileKey = `${ctx.user.id}/screenshots/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "image/png");

        const response = await callLLMWithRetry({
          messages: [
            { role: "system", content: "Extract all text from this screenshot. Return only the text content, preserving the conversation structure." },
            { role: "user", content: [
              { type: "text", text: "Extract the text from this conversation screenshot:" },
              { type: "image_url", image_url: { url, detail: "high" } }
            ] },
          ],
        });

        const ocrContent = response.choices[0]?.message?.content;
        const extractedText = typeof ocrContent === 'string' ? ocrContent : '';

        return { url, extractedText };
      }),

    // Import existing conversation (for prospects who already messaged but didn't reply)
    importConversation: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        conversationText: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.prospectId, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        // Parse the conversation and create messages
        const lines = input.conversationText.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          // Try to detect if it's from prospect or user
          const isFromProspect = line.toLowerCase().startsWith('them:') || 
                                  line.toLowerCase().startsWith('prospect:') ||
                                  line.toLowerCase().startsWith(`${prospect.name.toLowerCase()}:`);
          
          const content = line.replace(/^(them|prospect|me|you|[^:]+):\s*/i, '').trim();
          if (!content) continue;

          await db.createChatMessage({
            prospectId: input.prospectId,
            userId: ctx.user.id,
            direction: isFromProspect ? "inbound" : "outbound",
            content,
            wasSent: true,
          });
        }

        return { success: true, message: "Conversation imported successfully" };
      }),

    // Send inbound message and get AI suggestions with RAG
    sendInbound: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        content: z.string().min(1),
        screenshotUrl: z.string().optional(),
        threadType: z.enum(["friend", "expert"]).optional().default("friend"),
      }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.prospectId, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        // CHECK: Require knowledge base content before generating replies
        const brainStats = await db.getOrCreateBrainStats(ctx.user.id);
        if (!brainStats || (brainStats.totalChunks ?? 0) === 0) {
          throw new Error("Your AI brain is empty! Please upload sales training books or videos first to train your AI. Go to Knowledge Base and add content.");
        }

        const workspace = await db.getWorkspace(prospect.workspaceId, ctx.user.id);
        const conversationContext = await db.getConversationContext(input.prospectId, ctx.user.id);
        
        // First, detect the conversation stage/context
        const stageDetection = await callLLMWithRetry({
          messages: [
            { role: "system", content: "Analyze this sales conversation and determine the current stage." },
            { role: "user", content: `Previous conversation:\n${conversationContext || "None"}\n\nLatest message: ${input.content}\n\nWhat stage is this conversation in? Reply with one of: first_contact, warm_rapport, pain_discovery, objection_resistance, trust_reinforcement, referral_to_expert, expert_close, general` },
          ],
        });
        const stageContent = stageDetection.choices[0]?.message?.content;
        const detectedStage = typeof stageContent === 'string' ? stageContent.trim().toLowerCase() : 'general';

        // Get relevant knowledge chunks based on conversation stage
        const relevantCategories = getRelevantCategories(detectedStage);
        const knowledgeChunks = await db.searchKnowledgeChunks(
          ctx.user.id,
          relevantCategories,
          prospect.replyMode || "friend",
          8
        );

        // Also get general knowledge items for context
        const knowledgeItems = await db.getReadyKnowledgeBaseContent(
          ctx.user.id, 
          prospect.replyMode || "friend",
          prospect.workspaceId
        );

        // Build comprehensive knowledge context
        let knowledgeContext = "";
        
        if (knowledgeChunks.length > 0) {
          knowledgeContext += "SPECIFIC KNOWLEDGE FOR THIS SITUATION:\n";
          knowledgeContext += knowledgeChunks.map(c => `• [${c.category.replace(/_/g, ' ').toUpperCase()}]: ${c.content}`).join("\n");
          knowledgeContext += "\n\n";
        }

        if (knowledgeItems.length > 0) {
          knowledgeContext += "GENERAL SALES KNOWLEDGE:\n";
          for (const item of knowledgeItems.slice(0, 3)) {
            if (item.objectionFrameworks && detectedStage.includes('objection')) {
              knowledgeContext += `• Objection Handling: ${item.objectionFrameworks}\n`;
            }
            if (item.rapportTechniques && (detectedStage.includes('rapport') || detectedStage.includes('first'))) {
              knowledgeContext += `• Rapport Building: ${item.rapportTechniques}\n`;
            }
            if (item.closingTechniques && detectedStage.includes('close')) {
              knowledgeContext += `• Closing: ${item.closingTechniques}\n`;
            }
            if (item.languagePatterns) {
              knowledgeContext += `• Language Patterns: ${item.languagePatterns}\n`;
            }
          }
        }

        // Create the inbound message
        const messageId = await db.createChatMessage({
          prospectId: input.prospectId,
          userId: ctx.user.id,
          direction: "inbound",
          content: input.content,
          screenshotUrl: input.screenshotUrl,
          threadType: input.threadType,
        });

        const modeInstructions = prospect.replyMode === "expert" 
          ? EXPERT_MODE_INSTRUCTIONS 
          : FRIEND_MODE_INSTRUCTIONS;

        // Generate AI suggestions with full knowledge context
        const analysisPrompt = `You are a sales conversation coach. Use ALL the knowledge provided to craft the perfect reply.

${modeInstructions}

YOUR BUSINESS CONTEXT:
${workspace?.profileAnalysis || workspace?.nicheDescription || "Not specified"}
Products/Services: ${workspace?.productsDetected || "Not specified"}

PROSPECT CONTEXT:
Name: ${prospect.name}
Profile: ${prospect.profileAnalysis || "Not analyzed"}
Interests: ${prospect.detectedInterests || "Unknown"}
Current Stage: ${detectedStage}

${knowledgeContext ? `YOUR SALES TRAINING KNOWLEDGE (USE THIS!):\n${knowledgeContext}\n` : ""}

CONVERSATION HISTORY:
${conversationContext || "This is the first message"}

LATEST MESSAGE FROM PROSPECT:
${input.content}

IMPORTANT: You MUST use the knowledge provided above to craft your responses. Reference specific techniques, phrases, and strategies from your training.

Analyze this message and provide reply suggestions based on your training.`;

        const response = await callLLMWithRetry({
          messages: [
            { role: "system", content: "You are an expert sales coach. Use the knowledge base provided to craft responses. Always respond with valid JSON only." },
            { role: "user", content: analysisPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "chat_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  contextType: { type: "string" },
                  detectedTone: { type: "string" },
                  primaryReply: { type: "string" },
                  alternativeReply: { type: "string" },
                  softReply: { type: "string" },
                  whyThisWorks: { type: "string" },
                  knowledgeUsed: { type: "string", description: "Which knowledge from the training was used" },
                  pushyWarning: { type: ["string", "null"] },
                },
                required: ["contextType", "detectedTone", "primaryReply", "alternativeReply", "softReply", "whyThisWorks", "knowledgeUsed", "pushyWarning"],
                additionalProperties: false,
              },
            },
          },
        });

        const analysisContent = response.choices[0]?.message?.content;
        const analysis = JSON.parse(typeof analysisContent === 'string' ? analysisContent : '{}');

        await db.updateProspect(input.prospectId, ctx.user.id, {
          conversationStage: analysis.contextType as any,
        });

        const suggestions = [];
        
        const primaryId = await db.createAiSuggestion({
          messageId,
          prospectId: input.prospectId,
          userId: ctx.user.id,
          suggestionText: analysis.primaryReply,
          suggestionType: "primary",
          whyThisWorks: `${analysis.whyThisWorks}\n\nKnowledge Used: ${analysis.knowledgeUsed}`,
          pushyWarning: analysis.pushyWarning,
        });
        suggestions.push({ id: primaryId, type: "primary", text: analysis.primaryReply, whyThisWorks: analysis.whyThisWorks, knowledgeUsed: analysis.knowledgeUsed });

        const altId = await db.createAiSuggestion({
          messageId,
          prospectId: input.prospectId,
          userId: ctx.user.id,
          suggestionText: analysis.alternativeReply,
          suggestionType: "alternative",
        });
        suggestions.push({ id: altId, type: "alternative", text: analysis.alternativeReply });

        const softId = await db.createAiSuggestion({
          messageId,
          prospectId: input.prospectId,
          userId: ctx.user.id,
          suggestionText: analysis.softReply,
          suggestionType: "soft",
        });
        suggestions.push({ id: softId, type: "soft", text: analysis.softReply });

        return {
          messageId,
          analysis: {
            contextType: analysis.contextType,
            detectedTone: analysis.detectedTone,
            pushyWarning: analysis.pushyWarning,
            knowledgeUsed: analysis.knowledgeUsed,
          },
          suggestions,
        };
      }),

    sendOutbound: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        content: z.string().min(1),
        suggestionId: z.number().optional(),
        isAiSuggestion: z.boolean().default(false),
        threadType: z.enum(["friend", "expert"]).optional().default("friend"),
      }))
      .mutation(async ({ ctx, input }) => {
        const messageId = await db.createChatMessage({
          prospectId: input.prospectId,
          userId: ctx.user.id,
          direction: "outbound",
          content: input.content,
          isAiSuggestion: input.isAiSuggestion,
          wasSent: true,
          threadType: input.threadType,
        });

        if (input.suggestionId) {
          await db.updateAiSuggestionUsage(input.suggestionId, ctx.user.id, true);
        }

        return { messageId, success: true };
      }),

    getSuggestions: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getAiSuggestions(input.messageId, ctx.user.id);
      }),

    suggestionFeedback: protectedProcedure
      .input(z.object({
        id: z.number(),
        feedback: z.enum(["helpful", "not_helpful"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateAiSuggestionFeedback(input.id, ctx.user.id, input.feedback);
        return { success: true };
      }),

    refineExpertMessage: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        expertMessage: z.string().min(1),
        expertNotes: z.string().optional(),
        threadType: z.enum(["friend", "expert"]).default("expert"),
      }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.prospectId, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        const workspace = await db.getWorkspace(prospect.workspaceId, ctx.user.id);
        const conversationContext = await db.getConversationContext(input.prospectId, ctx.user.id);

        // Get relevant knowledge chunks
        const knowledgeChunks = await db.searchKnowledgeChunks(
          ctx.user.id,
          ["closing_techniques", "objection_handling", "psychology_insight"],
          "expert",
          5
        );
        const knowledgeContext = knowledgeChunks.length > 0
          ? `\n\nYOUR LEARNED KNOWLEDGE:\n${knowledgeChunks.map(c => `[${c.category}]: ${c.content}`).join("\n")}`
          : "";

        const refinementPrompt = `You are an expert sales coach refining a message from a sales expert.

CONTEXT:
Workspace: ${workspace?.nicheDescription || "Not specified"}
Prospect: ${prospect.name}
Conversation History:
${conversationContext || "No previous conversation"}

EXPERT'S MESSAGE:
${input.expertMessage}

${input.expertNotes ? `EXPERT'S NOTES:\n${input.expertNotes}\n` : ""}
${knowledgeContext}

Your task: Refine the expert's message to be emotionally compelling, persuasive, and impossible to say no to. Keep the expert's core intent but enhance it with:
1. Emotional triggers and psychological principles
2. Urgency and scarcity where appropriate
3. Social proof or authority
4. Clear call-to-action
5. Professional yet warm tone

Return ONLY the refined message, ready to send.`;

        const response = await callLLMWithRetry({
          messages: [
            { role: "system", content: "You are an expert sales message refiner. Return only the refined message, nothing else." },
            { role: "user", content: refinementPrompt },
          ],
        });

        const refinedMessage = response.choices[0]?.message?.content || input.expertMessage;

        // Save the refined message as outbound
        const messageId = await db.createChatMessage({
          prospectId: input.prospectId,
          userId: ctx.user.id,
          direction: "outbound",
          content: typeof refinedMessage === 'string' ? refinedMessage : input.expertMessage,
          isAiSuggestion: true,
          wasSent: true,
          threadType: input.threadType,
        });

        return { 
          messageId, 
          refinedMessage: typeof refinedMessage === 'string' ? refinedMessage : input.expertMessage,
          success: true 
        };
      }),
  }),

  // ============ KNOWLEDGE BASE WITH RAG ============
  knowledgeBase: router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getKnowledgeBaseItems(ctx.user.id, input.workspaceId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getKnowledgeBaseItem(input.id, ctx.user.id);
      }),

    addUrl: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        url: z.string().url(),
        workspaceId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const platform = detectPlatform(input.url);
        const id = await db.createKnowledgeBaseItem({
          userId: ctx.user.id,
          workspaceId: input.workspaceId,
          type: "url",
          title: input.title,
          sourceUrl: input.url,
          platform,
          status: "pending",
        });
        return { id, platform, success: true };
      }),

    addPdf: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        fileBase64: z.string(),
        fileName: z.string(),
        workspaceId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `${ctx.user.id}/pdfs/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "application/pdf");

        const id = await db.createKnowledgeBaseItem({
          userId: ctx.user.id,
          workspaceId: input.workspaceId,
          type: "pdf",
          title: input.title,
          sourceUrl: url,
          status: "pending",
        });
        return { id, url, success: true };
      }),

    // Deep learning process with RAG chunk extraction
    processItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getKnowledgeBaseItem(input.id, ctx.user.id);
        if (!item) throw new Error("Item not found");

        await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { 
          status: "processing",
          processingProgress: 5,
        });

        try {
          let fullContent = "";

          // Step 1: Extract full content
          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { processingProgress: 10 });

          if (item.type === "url") {
            const platform = item.platform || detectPlatform(item.sourceUrl);
            
            const extractResponse = await callLLMWithRetry({
              messages: [
                { 
                  role: "system", 
                  content: `You are a sales training content analyzer. Extract EVERYTHING from this ${platform} content that could help someone become better at sales conversations. Be thorough and detailed.` 
                },
                { 
                  role: "user", 
                  content: `Analyze this ${platform} content completely:
Title: ${item.title}
URL: ${item.sourceUrl}

Extract ALL learnings including:
- Sales techniques and methodologies (step by step)
- Specific phrases, scripts, and word choices to use
- Objection handling approaches with examples
- Conversation frameworks and structures
- Psychology principles and why they work
- Rapport and trust building techniques
- Closing techniques and when to use them
- Language patterns that convert
- Emotional triggers and how to use them
- Opening lines and first message strategies
- Pain discovery questions
- Story frameworks

Be as detailed as possible. Include specific examples and scripts.` 
                },
              ],
            });
            const extractContent = extractResponse.choices[0]?.message?.content;
            fullContent = typeof extractContent === 'string' ? extractContent : '';
          } else if (item.type === "pdf") {
            const pdfResponse = await callLLMWithRetry({
              messages: [
                { role: "system", content: "You are a sales training book analyzer. Read this ENTIRE document and extract EVERYTHING that could help someone become better at sales. Be extremely thorough." },
                { role: "user", content: [
                  { type: "text", text: `Read this entire PDF from start to finish and extract ALL sales knowledge:
Title: ${item.title}

Extract EVERYTHING including:
- Sales techniques and methodologies (step by step)
- Specific phrases, scripts, and word choices
- Objection handling with examples
- Conversation frameworks
- Psychology principles
- Rapport and trust building
- Closing techniques
- Language patterns
- Emotional triggers
- Opening lines
- Pain discovery questions
- Story frameworks
- Case studies and examples

Be as detailed as possible. This is training material for a sales AI.` },
                  { type: "file_url", file_url: { url: item.sourceUrl, mime_type: "application/pdf" } }
                ] },
              ],
            });
            const pdfContent = pdfResponse.choices[0]?.message?.content;
            fullContent = typeof pdfContent === 'string' ? pdfContent : '';
          }

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { 
            fullContent,
            processingProgress: 40,
          });

          if (!fullContent || fullContent.trim().length === 0) {
            fullContent = `Content from: ${item.title}. Unable to extract detailed content.`;
          }

          const maxContentLength = 12000;
          const truncatedContent = fullContent.length > maxContentLength 
            ? fullContent.substring(0, maxContentLength) + "... [content truncated]"
            : fullContent;

          // Step 2: Generate structured summary
          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { processingProgress: 50 });

          const summaryResponse = await callLLMWithRetry({
            messages: [
              { role: "system", content: "You are a sales training expert. Organize the content into structured categories for a sales AI knowledge base." },
              { role: "user", content: `Based on this content, provide a comprehensive structured summary:

${truncatedContent}

Provide detailed information for each category:` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "deep_learning_summary",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    comprehensiveSummary: { type: "string", description: "Overall summary of what was learned" },
                    salesPsychology: { type: "string", description: "Psychology principles and insights" },
                    rapportTechniques: { type: "string", description: "Rapport building techniques" },
                    conversationStarters: { type: "string", description: "Opening lines and first message strategies" },
                    objectionFrameworks: { type: "string", description: "How to handle objections" },
                    closingTechniques: { type: "string", description: "Techniques for closing" },
                    languagePatterns: { type: "string", description: "Specific phrases and language patterns" },
                    emotionalTriggers: { type: "string", description: "Emotional triggers and responses" },
                    trustStrategies: { type: "string", description: "Strategies for building trust" },
                  },
                  required: ["comprehensiveSummary", "salesPsychology", "rapportTechniques", "conversationStarters", "objectionFrameworks", "closingTechniques", "languagePatterns", "emotionalTriggers", "trustStrategies"],
                  additionalProperties: false,
                },
              },
            },
          });

          const summaryContent = summaryResponse.choices[0]?.message?.content;
          let summary;
          try {
            summary = JSON.parse(typeof summaryContent === 'string' ? summaryContent : '{}');
          } catch {
            summary = {
              comprehensiveSummary: fullContent.substring(0, 500),
              salesPsychology: "Not extracted",
              rapportTechniques: "Not extracted",
              conversationStarters: "Not extracted",
              objectionFrameworks: "Not extracted",
              closingTechniques: "Not extracted",
              languagePatterns: "Not extracted",
              emotionalTriggers: "Not extracted",
              trustStrategies: "Not extracted",
            };
          }

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, {
            ...summary,
            processingProgress: 70,
          });

          // Step 3: Extract knowledge chunks for RAG
          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { processingProgress: 75 });

          // Delete any existing chunks for this source
          await db.deleteKnowledgeChunksBySource(input.id, ctx.user.id);

          const chunkResponse = await callLLMWithRetry({
            messages: [
              { role: "system", content: "You are a knowledge extraction expert. Extract specific, actionable pieces of knowledge that can be used in sales conversations." },
              { role: "user", content: `Extract specific knowledge chunks from this content. Each chunk should be a standalone piece of advice, technique, phrase, or insight that can be used in sales conversations.

${truncatedContent}

Provide 15-25 specific knowledge chunks in JSON format:` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "knowledge_chunks",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    chunks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          category: { 
                            type: "string", 
                            enum: ["opening_lines", "rapport_building", "pain_discovery", "objection_handling", "trust_building", "closing_techniques", "psychology_insight", "language_pattern", "emotional_trigger", "general_wisdom"]
                          },
                          content: { type: "string", description: "The specific knowledge, technique, phrase, or insight" },
                          triggerPhrases: { type: "string", description: "When to use this knowledge (keywords or situations)" },
                          usageExample: { type: "string", description: "Example of how to use this in a conversation" },
                        },
                        required: ["category", "content", "triggerPhrases", "usageExample"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["chunks"],
                  additionalProperties: false,
                },
              },
            },
          });

          const chunkContent = chunkResponse.choices[0]?.message?.content;
          let chunksData;
          try {
            chunksData = JSON.parse(typeof chunkContent === 'string' ? chunkContent : '{"chunks":[]}');
          } catch {
            chunksData = { chunks: [] };
          }

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { processingProgress: 90 });

          // Save chunks to database
          if (chunksData.chunks && chunksData.chunks.length > 0) {
            const chunksToInsert = chunksData.chunks.map((chunk: any) => ({
              userId: ctx.user.id,
              sourceId: input.id,
              category: chunk.category,
              content: chunk.content,
              triggerPhrases: chunk.triggerPhrases,
              usageExample: chunk.usageExample,
              relevanceScore: 50,
              brainType: item.brainType || "both",
            }));

            await db.createKnowledgeChunks(chunksToInsert);
          }

          // Update brain stats
          await db.updateBrainStats(ctx.user.id);

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, {
            status: "ready",
            processingProgress: 100,
          });

          const brainStats = await db.getOrCreateBrainStats(ctx.user.id);

          return { 
            success: true, 
            ...summary,
            chunksExtracted: chunksData.chunks?.length || 0,
            brainStats,
          };
        } catch (error) {
          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { 
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          });
          throw error;
        }
      }),

    setBrainType: protectedProcedure
      .input(z.object({
        id: z.number(),
        brainType: z.enum(["friend", "expert", "both"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateKnowledgeBaseItem(input.id, ctx.user.id, {
          brainType: input.brainType,
        });
        
        // Also update all chunks from this source
        const chunks = await db.getKnowledgeChunksBySource(input.id, ctx.user.id);
        for (const chunk of chunks) {
          // Update chunk brain type (would need a new function, but for now we'll skip)
        }
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Delete associated chunks first
        await db.deleteKnowledgeChunksBySource(input.id, ctx.user.id);
        await db.deleteKnowledgeBaseItem(input.id, ctx.user.id);
        
        // Update brain stats
        await db.updateBrainStats(ctx.user.id);
        
        return { success: true };
      }),

    brainStats: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getBrainStats(ctx.user.id);
      }),
  }),

  // ============ ANALYTICS ============
  analytics: router({
    getStats: protectedProcedure
      .input(z.object({ workspaceId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const workspaceId = input.workspaceId || (await db.getActiveWorkspace(ctx.user.id))?.id;
        if (!workspaceId) {
          return {
            total: 0,
            won: 0,
            lost: 0,
            ghosted: 0,
            active: 0,
            conversionRate: 0,
            friendMode: { total: 0, won: 0, conversionRate: 0 },
            expertMode: { total: 0, won: 0, conversionRate: 0 },
          };
        }
        return db.getProspectStats(workspaceId, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
