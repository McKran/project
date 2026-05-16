import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  SendOpenaiMessageParams,
} from "@workspace/api-zod";

const router = Router();

const SYSTEM_PROMPT = `You are AgriBot, an expert AI agricultural assistant specializing in practical farming guidance for smallholder and commercial farmers. You have deep knowledge in:

- Crop selection and rotation strategies
- Pest and disease identification and management
- Fertilizer application and soil health
- Irrigation scheduling and water management
- Harvest timing and post-harvest handling
- Weather-based farming decisions
- Market timing and crop value optimization
- Sustainable and regenerative farming practices

When answering questions:
- Be concise and actionable — farmers need clear, practical advice
- Use local context when provided (location, season, crop type)
- Quantify recommendations where possible (e.g., "apply 50kg/ha of CAN")
- Flag urgent issues (pest outbreaks, weather risks) prominently
- Consider smallholder resource constraints
- Speak directly to the farmer in a warm, knowledgeable tone

You are not a medical or legal advisor. Stick to agricultural topics.`;

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
  const userContent = bodyParsed.data.content;
  const context = (bodyParsed.data as { context?: { location?: string | null; currentCrop?: string | null } }).context;

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
      ? `\n\n[Farmer context: Location: ${context?.location ?? "unknown"}, Current crop focus: ${context?.currentCrop ?? "general"}]`
      : "";

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT + contextNote },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });
  } catch (err) {
    req.log.error({ err }, "Error in AI chat");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.end();
    }
  }
});

export default router;
