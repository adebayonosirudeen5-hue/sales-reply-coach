import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import * as db from "./db";

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

  // User profile management
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return {
        salesStyle: ctx.user.salesStyle,
        industry: ctx.user.industry,
        productDescription: ctx.user.productDescription,
        tonePreference: ctx.user.tonePreference,
        companyName: ctx.user.companyName,
      };
    }),
    
    update: protectedProcedure
      .input(z.object({
        salesStyle: z.string().nullable().optional(),
        industry: z.string().nullable().optional(),
        productDescription: z.string().nullable().optional(),
        tonePreference: z.string().nullable().optional(),
        companyName: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // Knowledge base management
  knowledgeBase: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getKnowledgeBaseItems(ctx.user.id);
    }),

    addVideo: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        url: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createKnowledgeBaseItem({
          userId: ctx.user.id,
          type: "video",
          title: input.title,
          sourceUrl: input.url,
          status: "pending",
        });
        return { id, success: true };
      }),

    addPdf: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `${ctx.user.id}/pdfs/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "application/pdf");

        const id = await db.createKnowledgeBaseItem({
          userId: ctx.user.id,
          type: "pdf",
          title: input.title,
          sourceUrl: url,
          status: "pending",
        });
        return { id, url, success: true };
      }),

    processItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getKnowledgeBaseItem(input.id, ctx.user.id);
        if (!item) throw new Error("Item not found");

        await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { status: "processing" });

        try {
          let extractedContent = "";

          if (item.type === "video") {
            const videoResponse = await invokeLLM({
              messages: [
                { role: "system", content: "You are a sales training content analyzer. Extract key sales techniques, phrases, and methodologies from the video description or title. Create a concise summary of actionable sales advice." },
                { role: "user", content: `Analyze this sales training video and extract key insights:\nTitle: ${item.title}\nURL: ${item.sourceUrl}\n\nProvide a summary of sales techniques and key phrases that could be used in conversations.` },
              ],
            });
            const videoContent = videoResponse.choices[0]?.message?.content;
            extractedContent = typeof videoContent === 'string' ? videoContent : '';
          } else if (item.type === "pdf") {
            const pdfResponse = await invokeLLM({
              messages: [
                { role: "system", content: "You are a sales training content analyzer. Extract key sales techniques, scripts, objection handling methods, and conversation frameworks from this document. Focus on actionable phrases and approaches." },
                { role: "user", content: [
                  { type: "text", text: `Analyze this sales training PDF and extract key insights, scripts, and techniques:\nTitle: ${item.title}` },
                  { type: "file_url", file_url: { url: item.sourceUrl, mime_type: "application/pdf" } }
                ] },
              ],
            });
            const pdfContent = pdfResponse.choices[0]?.message?.content;
            extractedContent = typeof pdfContent === 'string' ? pdfContent : '';
          }

          // Generate "What I Learned" summary
          const summaryResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a sales training analyzer. Based on the extracted content, create a structured summary." },
              { role: "user", content: `Based on this extracted sales content, provide a JSON response with:
1. learnedSummary: A brief summary of what was learned (2-3 sentences)
2. objectionsHandled: List of objections this content helps handle (comma-separated)
3. languageStyles: Language patterns and styles detected (comma-separated)

Content:
${extractedContent}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "content_summary",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    learnedSummary: { type: "string" },
                    objectionsHandled: { type: "string" },
                    languageStyles: { type: "string" },
                  },
                  required: ["learnedSummary", "objectionsHandled", "languageStyles"],
                  additionalProperties: false,
                },
              },
            },
          });

          const summaryContent = summaryResponse.choices[0]?.message?.content;
          const summary = JSON.parse(typeof summaryContent === 'string' ? summaryContent : '{}');

          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, {
            extractedContent,
            learnedSummary: summary.learnedSummary,
            objectionsHandled: summary.objectionsHandled,
            languageStyles: summary.languageStyles,
            status: "ready",
          });

          return { 
            success: true, 
            extractedContent,
            learnedSummary: summary.learnedSummary,
            objectionsHandled: summary.objectionsHandled,
            languageStyles: summary.languageStyles,
          };
        } catch (error) {
          await db.updateKnowledgeBaseItem(input.id, ctx.user.id, { status: "failed" });
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

  // Conversation and suggestion management
  conversation: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversations(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversation(input.id, ctx.user.id);
        if (!conversation) throw new Error("Conversation not found");
        
        const suggestions = await db.getSuggestionsForConversation(input.id, ctx.user.id);
        return { conversation, suggestions };
      }),

    analyze: protectedProcedure
      .input(z.object({
        inputText: z.string().min(1),
        screenshotUrl: z.string().optional(),
        title: z.string().optional(),
        replyMode: z.enum(["friend", "expert"]).default("friend"),
        buyerName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get user's knowledge base content filtered by reply mode
        const knowledgeItems = await db.getReadyKnowledgeBaseContent(ctx.user.id, input.replyMode);
        const knowledgeContext = knowledgeItems
          .map(item => `[${item.type.toUpperCase()}: ${item.title}]\n${item.extractedContent}`)
          .join("\n\n---\n\n");

        // Get user profile for personalization
        const profile = {
          salesStyle: ctx.user.salesStyle || "consultative",
          industry: ctx.user.industry || "general",
          productDescription: ctx.user.productDescription || "",
          tonePreference: ctx.user.tonePreference || "professional",
          companyName: ctx.user.companyName || "",
        };

        // Build mode-specific instructions
        const modeInstructions = input.replyMode === "friend" 
          ? `FRIEND MODE PRINCIPLES:
- You are a friendly, relatable peer who speaks like a real person texting a friend
- You were once stuck, confused, and skeptical about online income - you found clarity
- You are now successful and stable, calm, confident, and NOT desperate
- You NEVER chase or convince - you understand and guide
- Sound human, casual, warm, and supportive
- NEVER use hype language or say "buy", "offer", or "program" unless asked
- Share personal experience naturally
- End most replies with a genuine question
- Listen first, mirror their words, respond emotionally before logically
- When someone shares doubt/fear/frustration: acknowledge emotion, share a personal moment, normalize their experience, ask a soft follow-up`
          : `EXPERT MODE PRINCIPLES:
- You are a knowledgeable professional who provides clear, direct guidance
- You speak with authority and confidence, backed by expertise
- You focus on solutions and value, not just rapport
- You can discuss products, services, and offers directly when relevant
- You provide structured, actionable advice
- You maintain professionalism while still being personable
- You can recommend specific next steps and resources
- You position yourself as a trusted advisor who can help them achieve their goals`;

        const analysisPrompt = `You are a sales conversation coach helping someone craft the perfect reply.

${modeInstructions}

CONVERSATION STAGES (detect which one applies):
1. First contact - warm, open-ended greeting
2. Warm rapport - building connection, finding common ground
3. Pain discovery - understanding their struggles
4. Objection or resistance - addressing concerns with empathy
5. Trust reinforcement - sharing proof as reassurance (not flexing)
6. Referral to expert - when ready to introduce guidance

USER PROFILE:
- Sales Style: ${profile.salesStyle}
- Industry: ${profile.industry}
- Product/Service: ${profile.productDescription}
- Preferred Tone: ${profile.tonePreference}
- Company: ${profile.companyName}

${knowledgeContext ? `USER'S SALES KNOWLEDGE BASE:\n${knowledgeContext}\n\n` : ""}

CONVERSATION TO ANALYZE:
${input.inputText}

Provide:
1. CONTEXT_TYPE: One of [objection, tone_shift, referral, first_message, follow_up, general]
2. DETECTED_TONE: The prospect's current tone/mood
3. PRIMARY_REPLY: A natural reply in ${input.replyMode.toUpperCase()} MODE
4. ALTERNATIVE_REPLY: A different approach (still ${input.replyMode.toUpperCase()} MODE)
5. EXPERT_REFERRAL: If appropriate, a way to mention guidance/support
6. REASONING: Why these replies work and any warnings if they might sound pushy

Format your response as JSON:
{
  "contextType": "...",
  "detectedTone": "...",
  "primaryReply": "...",
  "alternativeReply": "...",
  "expertReferral": "..." or null,
  "reasoning": "Brief explanation of why these replies work"
}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert sales coach. Always respond with valid JSON only." },
            { role: "user", content: analysisPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "conversation_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  contextType: { type: "string", enum: ["objection", "tone_shift", "referral", "first_message", "follow_up", "general"] },
                  detectedTone: { type: "string" },
                  primaryReply: { type: "string" },
                  alternativeReply: { type: "string" },
                  expertReferral: { type: ["string", "null"] },
                  reasoning: { type: "string" },
                },
                required: ["contextType", "detectedTone", "primaryReply", "alternativeReply", "expertReferral", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        });

        const analysisContent = response.choices[0]?.message?.content;
        const analysis = JSON.parse(typeof analysisContent === 'string' ? analysisContent : '{}');

        // Create conversation record with buyer name and reply mode
        const conversationId = await db.createConversation({
          userId: ctx.user.id,
          title: input.buyerName 
            ? `${input.buyerName} - ${new Date().toLocaleDateString()}`
            : input.title || `Conversation ${new Date().toLocaleDateString()}`,
          buyerName: input.buyerName,
          replyMode: input.replyMode,
          inputText: input.inputText,
          screenshotUrl: input.screenshotUrl,
          analysisContext: analysis.contextType as any,
          detectedTone: analysis.detectedTone,
        });

        // Create suggestion records
        const suggestionIds: number[] = [];
        const toneLabel = input.replyMode === "friend" ? "casual" : "professional";

        const primaryId = await db.createSuggestion({
          conversationId,
          userId: ctx.user.id,
          suggestionText: analysis.primaryReply,
          suggestionType: "primary",
          tone: toneLabel,
        });
        suggestionIds.push(primaryId);

        const altId = await db.createSuggestion({
          conversationId,
          userId: ctx.user.id,
          suggestionText: analysis.alternativeReply,
          suggestionType: "alternative",
          tone: toneLabel,
        });
        suggestionIds.push(altId);

        if (analysis.expertReferral) {
          const refId = await db.createSuggestion({
            conversationId,
            userId: ctx.user.id,
            suggestionText: analysis.expertReferral,
            suggestionType: "expert_referral",
            tone: "professional",
          });
          suggestionIds.push(refId);
        }

        return {
          conversationId,
          analysis: {
            contextType: analysis.contextType,
            detectedTone: analysis.detectedTone,
            reasoning: analysis.reasoning,
          },
          suggestions: [
            { id: primaryId, type: "primary", text: analysis.primaryReply },
            { id: altId, type: "alternative", text: analysis.alternativeReply },
            ...(analysis.expertReferral ? [{ id: suggestionIds[2], type: "expert_referral", text: analysis.expertReferral }] : []),
          ],
        };
      }),

    uploadScreenshot: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `${ctx.user.id}/screenshots/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "image/png");

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

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteConversation(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Suggestion feedback
  suggestion: router({
    markUsed: protectedProcedure
      .input(z.object({
        id: z.number(),
        wasUsed: z.enum(["yes", "no", "modified"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateSuggestionUsage(input.id, ctx.user.id, input.wasUsed);
        return { success: true };
      }),

    feedback: protectedProcedure
      .input(z.object({
        id: z.number(),
        feedback: z.enum(["helpful", "not_helpful", "neutral"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateSuggestionFeedback(input.id, ctx.user.id, input.feedback);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
