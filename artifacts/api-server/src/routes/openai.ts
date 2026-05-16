import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  SendOpenaiMessageParams,
} from "@workspace/api-zod";

const router = Router();

const DEEPSEEK_MODEL = "deepseek/deepseek-chat-v3-0324:free";
const FALLBACK_MODEL = "meta-llama/llama-4-scout:free";

const SYSTEM_PROMPT = `You are AgriBot, an expert AI agricultural assistant specializing in practical farming guidance for smallholder and commercial farmers worldwide. You have deep expertise in:

- Crop selection, rotation, and intercropping strategies
- Pest and disease identification, prevention, and management
- Fertilizer application, soil health, and composting
- Irrigation scheduling and water conservation
- Harvest timing, post-harvest handling, and storage
- Weather-based farming decisions and climate adaptation
- Market timing, price negotiation, and crop value optimization
- Sustainable, organic, and regenerative farming practices
- Agricultural finance, input cost management, and profit planning

When responding:
- Lead with the most actionable advice first
- Be specific: give dosages, timings, quantities (e.g., "Apply 50kg CAN/ha at knee height")
- Use the farmer's location and crop context to tailor your answer
- Clearly flag urgent or time-sensitive issues
- Consider smallholder resource constraints
- Use bullet points and headers for multi-part answers
- Keep responses concise but complete — farmers are busy

You are not a medical or legal advisor. Stay focused on agriculture.`;

const requestTimestamps = new Map<number, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;

function isThrottled(conversationId: number): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const times = (requestTimestamps.get(conversationId) ?? []).filter(t => t > oneMinuteAgo);
  requestTimestamps.set(conversationId, times);
  if (times.length >= MAX_REQUESTS_PER_MINUTE) return true;
  times.push(now);
  return false;
}

router.get("/openai/conversations", async (req, res) => {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(allConversations);
  } catch (err) {
    req.log.error({ err }, "Error listing conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [conversation] = await db
      .insert(conversations)
      .values({ title: parsed.data.title })
      .returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error({ err }, "Error creating conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/openai/conversations/:id", async (req, res) => {
  const parsed = GetOpenaiConversationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parsed.data.id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, parsed.data.id))
      .orderBy(messages.createdAt);

    res.json({ ...conversation, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Error fetching conversation");
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const parsed = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(conversations)
      .where(eq(conversations.id, parsed.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const paramsParsed = SendOpenaiMessageParams.safeParse(req.params);
  const bodyParsed = SendOpenaiMessageBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const conversationId = paramsParsed.data.id;

  if (isThrottled(conversationId)) {
    res.status(429).json({ error: "Too many requests. Please wait a moment before sending another message." });
    return;
  }

  const userContent = bodyParsed.data.content;
  const context = (bodyParsed.data as any).context as {
    location?: string | null;
    currentCrop?: string | null;
  } | undefined;

  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: userContent,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const contextNote = context?.location || context?.currentCrop
      ? `\n\n[Farmer context — Location: ${context?.location ?? "unknown"}, Crop focus: ${context?.currentCrop ?? "general"}]`
      : "";

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT + contextNote },
      ...history.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let fullResponse = "";
    let streamSuccess = false;

    const tryStream = async (useDeepSeek: boolean): Promise<boolean> => {
      try {
        const client = useDeepSeek ? openrouter : openai;
        const model = useDeepSeek ? DEEPSEEK_MODEL : "gpt-5-mini";

        const stream = await (client as any).chat.completions.create({
          model,
          max_tokens: 1500,
          messages: chatMessages,
          stream: true,
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        return true;
      } catch (err: any) {
        req.log.warn({ err, useDeepSeek }, "Stream attempt failed, will try fallback");
        return false;
      }
    };

    streamSuccess = await tryStream(true);

    if (!streamSuccess) {
      fullResponse = "";
      streamSuccess = await tryStream(false);
    }

    if (!streamSuccess) {
      res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable. Please try again." })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    if (fullResponse) {
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: fullResponse,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Error in AI chat");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted. Please try again." })}\n\n`);
      res.end();
    }
  }
});

export default router;
