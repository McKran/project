import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  SendOpenaiMessageParams,
} from "@workspace/api-zod";

const router = Router();

const MODEL_CHAIN = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen2.5-7b-instruct:free",
];

const SYSTEM_PROMPT = `You are AgriBot, an expert AI agricultural assistant built specifically for Filipino farmers and the Philippine agricultural system. You have deep expertise in:

**Philippine Crops & Production:**
- Palay (rice) and mais (corn) — the two major staple crops
- High-value crops: coconut, sugarcane, banana, pineapple, mango, cacao
- Vegetables: ampalaya, sitaw, kamote, pechay, tomato, onion, garlic
- Root crops: cassava, kamote, gabi, ube
- Export crops: Cavendish banana, abaca, seaweed, asparagus

**Philippine Government Programs & Agencies:**
- DA (Department of Agriculture) programs: RCEF, KADIWA, Expanded SURE Aid
- PhilFoodEx and the SRA (Sugar Regulatory Administration)
- PCIC (Philippine Crop Insurance Corporation) coverage and claims
- NFA (National Food Authority) palay buying prices
- ACPC (Agricultural Credit Policy Council) and farmer financing
- MASAGANA series programs and DA regional offices

**Regional & Climate Context:**
- PAGASA typhoon season (June–November), signal classifications, and storm surge alerts
- El Niño and La Niña impacts on Philippine farming
- Three island group farming zones: Luzon, Visayas, Mindanao
- Philippine soil classification and irrigation systems (NIA)
- CALABARZON, Cordillera, Cagayan Valley, Central Luzon, Bicol, Western Visayas, Mindanao agri belts

**Economics & Markets:**
- All pricing in Philippine Peso (PHP) as base currency
- DA weekly farmgate price bulletins and price ceilings (EO 39)
- PSA (Philippine Statistics Authority) agricultural data
- Local trading posts, wet markets, and trading centers
- Agri-tourism and direct-to-consumer farming

**Practical Guidance:**
- Integrated Pest Management (IPM) for Philippine conditions
- Seed varieties: NSIC-certified rice/corn varieties, hybrid vs open-pollinated
- Fertilizer use: Urea, Ammonium Sulfate, Complete (14-14-14), Organic (compost, vermicast)
- Water management for rainfed and irrigated farms
- Harvest, post-harvest, and value-adding for Philippine conditions

When responding:
- Always use PHP (₱) for prices; provide USD equivalent only if specifically requested
- Reference PAGASA, DA, and PSA data when applicable
- Be specific about timing (planting calendar, bayanihan harvest dates, etc.)
- Adapt advice to the farmer's specific region and crop context
- Flag typhoon, flooding, and drought risks proactively
- Use Filipino farming terms naturally (palay, mais, baha, tag-ulan, tag-araw)
- Keep responses practical and actionable for smallholder Filipino farmers
- Format multi-part answers with headers and bullet points

You are not a medical or legal advisor. Stay focused on Philippine agriculture.`;

const requestTimestamps = new Map<number, number[]>();
const MAX_REQUESTS_PER_MINUTE = 12;

function isThrottled(conversationId: number): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const times = (requestTimestamps.get(conversationId) ?? []).filter(t => t > oneMinuteAgo);
  requestTimestamps.set(conversationId, times);
  if (times.length >= MAX_REQUESTS_PER_MINUTE) return true;
  times.push(now);
  return false;
}

async function streamFromModelChain(
  chatMessages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
  onChunk: (content: string) => void,
  log: any,
): Promise<{ success: boolean; modelUsed: string | null }> {
  for (const model of MODEL_CHAIN) {
    try {
      const stream = await (openrouter as any).chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: chatMessages,
        stream: true,
        temperature,
      });
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      }
      return { success: true, modelUsed: model };
    } catch (err: any) {
      log.warn({ model, err: err?.message ?? String(err) }, "Model failed, trying next in chain");
    }
  }
  return { success: false, modelUsed: null };
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

router.post("/openai/conversations/:id/welcome", async (req, res) => {
  const paramsParsed = GetOpenaiConversationParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }

  const conversationId = paramsParsed.data.id;
  const context = (req.body ?? {}) as {
    location?: string;
    crops?: string[];
    targetMarket?: string;
    cityName?: string;
    regionName?: string;
  };

  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    if (existingMessages.length > 0) {
      res.status(409).json({ error: "Conversation already has messages" });
      return;
    }

    const locationStr = [context.cityName, context.regionName, "Philippines"]
      .filter(Boolean)
      .join(", ");
    const crops = context.crops?.length ? context.crops.join(", ") : "general farming";
    const market = context.targetMarket ?? "local";

    const welcomePrompt = `Generate a warm, helpful welcome message (3–5 sentences) for a Filipino farmer who just set up their AgriAssist profile. Their details:
- Location: ${locationStr}
- Crops: ${crops}
- Target market: ${market}

Greet them warmly in a mix of Filipino-friendly English (you may use a word or two of Filipino/Tagalog naturally). Confirm their setup, mention 1–2 things you can specifically help with right now (PAGASA weather, DA price bulletins, pest alerts, planting calendar, etc.). End with one practical question to start the conversation. Be friendly, specific, and concise.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let fullResponse = "";

    const { success } = await streamFromModelChain(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: welcomePrompt },
      ],
      400,
      0.8,
      (content) => {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      },
      req.log,
    );

    if (!success) {
      res.write(`data: ${JSON.stringify({ content: "Magandang araw! Welcome to AgriAssist. I'm your AI farming assistant for the Philippines. How can I help you today?" })}\n\n`);
      fullResponse = "Magandang araw! Welcome to AgriAssist. I'm your AI farming assistant for the Philippines. How can I help you today?";
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
    req.log.error({ err }, "Error generating welcome message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate welcome message" });
    } else {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
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
    currency?: string | null;
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

    const contextParts: string[] = [];
    if (context?.location) contextParts.push(`Location: ${context.location}, Philippines`);
    if (context?.currentCrop) contextParts.push(`Crop focus: ${context.currentCrop}`);
    if (context?.currency) contextParts.push(`Currency: ${context.currency}`);
    const contextNote = contextParts.length > 0
      ? `\n\n[Farmer context — ${contextParts.join(" | ")}]`
      : "";

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT + contextNote },
      ...history.slice(-24).map((m) => ({
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

    const { success } = await streamFromModelChain(
      chatMessages,
      1800,
      0.7,
      (content) => {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      },
      req.log,
    );

    if (!success) {
      res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable. Please try again in a moment." })}\n\n`);
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
