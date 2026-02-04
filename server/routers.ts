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
          isActive: true, // New workspace becomes active
        });
        
        // Deactivate other workspaces
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

    // Analyze user's own profile from social URLs
    analyzeProfile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspace(input.id, ctx.user.id);
        if (!workspace) throw new Error("Workspace not found");

        const urls = [
          workspace.instagramUrl,
          workspace.tiktokUrl,
          workspace.storeUrl,
          workspace.otherUrl,
        ].filter(Boolean);

        if (urls.length === 0 && !workspace.nicheDescription) {
          throw new Error("Please add at least one social URL or niche description");
        }

        const response = await invokeLLM({
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

  // ============ PROSPECT MANAGEMENT (WhatsApp-style contacts) ============
  prospect: router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getProspects(input.workspaceId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.id, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");
        const messages = await db.getChatMessages(input.id, ctx.user.id);
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
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProspect({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),

    // Analyze prospect's profile to suggest first message
    analyzeProfile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.id, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        const urls = [
          prospect.instagramUrl,
          prospect.tiktokUrl,
          prospect.storeUrl,
          prospect.otherUrl,
        ].filter(Boolean);

        if (urls.length === 0) {
          throw new Error("Please add at least one social URL for this prospect");
        }

        // Get workspace context
        const workspace = await db.getWorkspace(prospect.workspaceId, ctx.user.id);
        const workspaceContext = workspace ? `
Your Business: ${workspace.profileAnalysis || workspace.nicheDescription || "Not specified"}
Your Products: ${workspace.productsDetected || "Not specified"}` : "";

        const response = await invokeLLM({
          messages: [
            { role: "system", content: `You are a sales conversation strategist. Analyze the prospect's profile and suggest a personalized first message that will get them to reply.
${FRIEND_MODE_INSTRUCTIONS}` },
            { role: "user", content: `Analyze this prospect's profile and suggest a first message:
${workspaceContext}

Prospect's Profile:
Instagram: ${prospect.instagramUrl || "Not provided"}
TikTok: ${prospect.tiktokUrl || "Not provided"}
Store: ${prospect.storeUrl || "Not provided"}
Other: ${prospect.otherUrl || "Not provided"}

Provide a JSON response with:
1. profileAnalysis: What you learned about this prospect
2. detectedInterests: Their interests/niche
3. suggestedFirstMessage: A natural, friendly first message that references something specific about them` },
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

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        replyMode: z.enum(["friend", "expert"]).optional(),
        outcome: z.enum(["active", "won", "lost", "ghosted"]).optional(),
        outcomeNotes: z.string().optional(),
        conversationStage: z.enum([
          "first_contact", "warm_rapport", "pain_discovery",
          "objection_resistance", "trust_reinforcement",
          "referral_to_expert", "expert_close"
        ]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        await db.updateProspect(id, ctx.user.id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProspect(input.id, ctx.user.id);
        return { success: true };
      }),

    // Get stats for analytics
    stats: protectedProcedure
      .input(z.object({ workspaceId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getProspectStats(ctx.user.id, input.workspaceId);
      }),
  }),

  // ============ CHAT MESSAGES (WhatsApp-style) ============
  chat: router({
    getMessages: protectedProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getChatMessages(input.prospectId, ctx.user.id);
      }),

    // Upload screenshot and extract text via OCR
    uploadScreenshot: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `${ctx.user.id}/screenshots/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "image/png");

        // OCR the screenshot
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an OCR assistant. Extract all visible text from this screenshot of a conversation. Preserve the conversation structure, indicating who said what if possible. Return only the extracted text, no commentary." },
            { role: "user", content: [
              { type: "text", text: "Extract all text from this conversation screenshot:" },
              { type: "image_url", image_url: { url, detail: "high" } }
            ] },
          ],
        });

        const ocrContent = response.choices[0]?.message?.content;
        const extractedText = typeof ocrContent === 'string' ? ocrContent : '';

        return { url, extractedText };
      }),

    // Send inbound message (from prospect) and get AI suggestions
    sendInbound: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        content: z.string().min(1),
        screenshotUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prospect = await db.getProspect(input.prospectId, ctx.user.id);
        if (!prospect) throw new Error("Prospect not found");

        // Get workspace context
        const workspace = await db.getWorkspace(prospect.workspaceId, ctx.user.id);
        
        // Get conversation history
        const conversationContext = await db.getConversationContext(input.prospectId, ctx.user.id);
        
        // Get knowledge base content
        const knowledgeItems = await db.getReadyKnowledgeBaseContent(
          ctx.user.id, 
          prospect.replyMode || "friend",
          prospect.workspaceId
        );
        const knowledgeContext = knowledgeItems.map(k => 
          `[${k.title}]: ${k.comprehensiveSummary || k.fullContent || ''}`
        ).join("\n\n");

        // Create the inbound message
        const messageId = await db.createChatMessage({
          prospectId: input.prospectId,
          userId: ctx.user.id,
          direction: "inbound",
          content: input.content,
          screenshotUrl: input.screenshotUrl,
        });

        // Determine mode instructions
        const modeInstructions = prospect.replyMode === "expert" 
          ? EXPERT_MODE_INSTRUCTIONS 
          : FRIEND_MODE_INSTRUCTIONS;

        // Generate AI suggestions
        const analysisPrompt = `You are a sales conversation coach helping someone craft the perfect reply.

${modeInstructions}

YOUR BUSINESS CONTEXT:
${workspace?.profileAnalysis || workspace?.nicheDescription || "Not specified"}
Products/Services: ${workspace?.productsDetected || "Not specified"}

PROSPECT CONTEXT:
Name: ${prospect.name}
Profile: ${prospect.profileAnalysis || "Not analyzed"}
Interests: ${prospect.detectedInterests || "Unknown"}
Current Stage: ${prospect.conversationStage}

${knowledgeContext ? `YOUR SALES KNOWLEDGE BASE:\n${knowledgeContext}\n\n` : ""}

CONVERSATION HISTORY:
${conversationContext || "This is the first message"}

LATEST MESSAGE FROM PROSPECT:
${input.content}

Analyze this message and provide reply suggestions. Consider:
1. What stage of the conversation is this?
2. What is the prospect's emotional state?
3. What would be the most effective response?

Provide a JSON response with:
- contextType: The conversation stage
- detectedTone: The prospect's current tone/mood
- primaryReply: Your best suggested reply
- alternativeReply: A different approach
- softReply: A gentler/more cautious version
- whyThisWorks: Brief explanation of why the primary reply works
- pushyWarning: If any reply might sound pushy, explain why (or null)`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert sales coach. Always respond with valid JSON only." },
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
                  pushyWarning: { type: ["string", "null"] },
                },
                required: ["contextType", "detectedTone", "primaryReply", "alternativeReply", "softReply", "whyThisWorks", "pushyWarning"],
                additionalProperties: false,
              },
            },
          },
        });

        const analysisContent = response.choices[0]?.message?.content;
        const analysis = JSON.parse(typeof analysisContent === 'string' ? analysisContent : '{}');

        // Update the message with analysis
        await db.updateProspect(input.prospectId, ctx.user.id, {
          conversationStage: analysis.contextType as any,
        });

        // Create suggestion records
        const suggestions = [];
        
        const primaryId = await db.createAiSuggestion({
          messageId,
          prospectId: input.prospectId,
          userId: ctx.user.id,
          suggestionText: analysis.primaryReply,
          suggestionType: "primary",
          whyThisWorks: analysis.whyThisWorks,
          pushyWarning: analysis.pushyWarning,
        });
        suggestions.push({ id: primaryId, type: "primary", text: analysis.primaryReply, whyThisWorks: analysis.whyThisWorks });

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
          },
          suggestions,
        };
      }),

    // Record outbound message (what user actually sent)
    sendOutbound: protectedProcedure
      .input(z.object({
        prospectId: z.number(),
        content: z.string().min(1),
        suggestionId: z.number().optional(), // If they used an AI suggestion
        isAiSuggestion: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const messageId = await db.createChatMessage({
          prospectId: input.prospectId,
          userId: ctx.user.id,
          direction: "outbound",
          content: input.content,
          isAiSuggestion: input.isAiSuggestion,
          wasSent: true,
        });

        // Mark suggestion as used if provided
        if (input.suggestionId) {
          await db.updateAiSuggestionUsage(input.suggestionId, ctx.user.id, true);
        }

        return { messageId, success: true };
      }),

    // Get suggestions for a specific message
    getSuggestions: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getAiSuggestions(input.messageId, ctx.user.id);
      }),

    // Provide feedback on a suggestion
    suggestionFeedback: protectedProcedure
      .input(z.object({
        id: z.number(),
        feedback: z.enum(["helpful", "not_helpful"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateAiSuggestionFeedback(input.id, ctx.user.id, input.feedback);
        return { success: true };
      }),
  }),

  // ============ KNOWLEDGE BASE ============
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

    // Add URL (YouTube, Instagram, TikTok, etc.)
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

    // Deep learning process - reads entire content and extracts everything
    processItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getKnowledgeBaseItem(input.id, ctx.user.id);
        if (!item) throw new Error("Item not found");

        await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { 
          status: "processing",
          processingProgress: 10,
        });

        // Helper function to call LLM with retry logic
        async function callLLMWithRetry(params: Parameters<typeof invokeLLM>[0], maxRetries = 2): Promise<ReturnType<typeof invokeLLM>> {
          let lastError: Error | null = null;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await invokeLLM(params);
              // Validate response structure
              if (!result || !result.choices || !Array.isArray(result.choices)) {
                throw new Error("Invalid response structure from AI service");
              }
              return result;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              const errorMsg = lastError.message;
              
              // Check for HTML error response (service unavailable)
              if (errorMsg.includes("<html") || errorMsg.includes("<!DOCTYPE") || errorMsg.includes("not valid JSON")) {
                console.error(`LLM service unavailable (attempt ${attempt + 1}):`, "Service returned HTML error page");
                lastError = new Error("AI service is temporarily unavailable. Please try again in a few minutes.");
              } else {
                console.error(`LLM call attempt ${attempt + 1} failed:`, errorMsg);
              }
              
              if (attempt < maxRetries) {
                // Wait before retry (exponential backoff: 2s, 4s, 8s)
                const waitTime = 2000 * Math.pow(2, attempt);
                console.log(`Retrying in ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          throw lastError || new Error("AI service failed after multiple retries. Please try again later.");
        }

        try {
          let fullContent = "";

          // Step 1: Extract full content
          if (item.type === "url") {
            const platform = item.platform || detectPlatform(item.sourceUrl);
            
            const extractResponse = await callLLMWithRetry({
              messages: [
                { 
                  role: "system", 
                  content: `You are a content analyzer. Extract key insights from this ${platform} content.` 
                },
                { 
                  role: "user", 
                  content: `Analyze this ${platform} content:
Title: ${item.title}
URL: ${item.sourceUrl}

Extract the key learnings including:
- Sales techniques and methodologies
- Specific phrases and word choices
- Objection handling approaches
- Conversation frameworks
- Psychology principles
- Rapport and trust building techniques
- Closing techniques
- Language patterns` 
                },
              ],
            });
            const extractContent = extractResponse.choices[0]?.message?.content;
            fullContent = typeof extractContent === 'string' ? extractContent : '';
          } else if (item.type === "pdf") {
            const pdfResponse = await callLLMWithRetry({
              messages: [
                { role: "system", content: "You are a book analyzer. Extract key techniques and principles from this document for a sales knowledge base." },
                { role: "user", content: [
                  { type: "text", text: `Analyze this PDF and extract key learnings:
Title: ${item.title}

Focus on:
- Sales techniques and methodologies
- Specific phrases and scripts
- Objection handling approaches
- Conversation frameworks
- Psychology principles
- Rapport and trust building
- Closing techniques
- Language patterns` },
                  { type: "file_url", file_url: { url: item.sourceUrl, mime_type: "application/pdf" } }
                ] },
              ],
            });
            const pdfContent = pdfResponse.choices[0]?.message?.content;
            fullContent = typeof pdfContent === 'string' ? pdfContent : '';
          }

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { 
            fullContent,
            processingProgress: 50,
          });

          // If no content was extracted, create a basic summary
          if (!fullContent || fullContent.trim().length === 0) {
            fullContent = `Content from: ${item.title}. Unable to extract detailed content - the source may require manual review.`;
          }

          // Truncate content if too long to avoid token limits
          const maxContentLength = 8000;
          const truncatedContent = fullContent.length > maxContentLength 
            ? fullContent.substring(0, maxContentLength) + "... [content truncated]"
            : fullContent;

          // Step 2: Generate structured summary of what was learned
          const summaryResponse = await callLLMWithRetry({
            messages: [
              { role: "system", content: "You are a sales training expert. Organize the content into structured categories. Always provide helpful content even if the source material is limited." },
              { role: "user", content: `Based on this content, provide a structured summary:

${truncatedContent}

Provide a JSON response with information for each category:` },
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
                    rapportTechniques: { type: "string", description: "Techniques for building rapport" },
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
            // If JSON parsing fails, create a basic summary
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
            status: "ready",
            processingProgress: 100,
          });

          return { 
            success: true, 
            ...summary,
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
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteKnowledgeBaseItem(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
