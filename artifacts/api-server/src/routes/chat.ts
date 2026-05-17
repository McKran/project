/**
 * AI Chat Route — Groq + DeepSeek-R1
 *
 * Uses Groq API with deepseek-r1-distill-llama-70b model.
 * Specialized for Philippine agriculture assistance only.
 * Conversation history stored in MongoDB.
 */

import { Router } from "express";
import Groq from "groq-sdk";
import { connectMongo, Conversation, Message } from "../lib/mongodb";

const router = Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

function buildSystemPrompt(ctx: {
  cityName?: string;
  provinceName?: string;
  regionName?: string;
  regionCode?: string;
  provinceCode?: string;
  cityCode?: string;
  preferredCrops?: string[];
  weather?: { temperature?: number; condition?: string; humidity?: number } | null;
}): string {
  const location = [ctx.cityName, ctx.provinceName, ctx.regionName, "Philippines"]
    .filter(Boolean)
    .join(", ") || "Philippines";
  const crops =
    ctx.preferredCrops && ctx.preferredCrops.length > 0
      ? ctx.preferredCrops.join(", ")
      : "general crops";
  const weatherInfo = ctx.weather
    ? `Current weather: ${ctx.weather.temperature ?? "?"}°C, ${ctx.weather.condition ?? "unknown"}, Humidity: ${ctx.weather.humidity ?? "?"}%`
    : "";

  return `You are AgriAssist AI, an expert agricultural advisor exclusively for Filipino farmers.

FARMER PROFILE:
- Location: ${location}
  - Region Code: ${ctx.regionCode || "—"}
  - Province Code: ${ctx.provinceCode || "—"}
  - City/Municipality Code: ${ctx.cityCode || "—"}
- Primary Crops: ${crops}
${weatherInfo ? `- ${weatherInfo}` : ""}

YOUR ROLE:
You provide expert, practical agriculture guidance ONLY. You specialize in:
1. Crop advice (planting, care, variety selection for the farmer's PSGC location and climate)
2. Pest and disease diagnosis (identification, treatment, prevention)
3. Fertilizer scheduling (nutrient management, timing, rates)
4. Irrigation guidance (scheduling, water management, ET-based advice)
5. Weather interpretation (how current/forecasted weather affects crops)
6. Farm planning (season planning, crop rotation, intercropping)
7. Market explanation (price trends, when to sell, commodity insights)

STRICT RULES:
- ONLY answer questions about agriculture, farming, crops, soil, weather for farming, pests, fertilizers, and market prices.
- If asked about ANYTHING unrelated to agriculture, respond: "I'm specialized for agricultural guidance only. Please ask me about your crops, farming practices, pests, fertilizers, weather, or market prices."
- Always tailor advice to the farmer's specific PSGC location (${location}).
- Always consider the farmer's crop profile (${crops}) when giving advice.
- Give concise, practical, actionable answers in clear language.
- Use Filipino farming context (Philippine climate, wet/dry seasons, typhoon risks, local pests).
- Format with bullet points and numbered steps when listing tasks.
- Do not hallucinate — if unsure, say so and recommend consulting a local agronomist.

Respond in English. Be practical and concise.`;
}

/** GET /api/chat/status */
router.get("/chat/status", (_req, res) => {
  const ready = !!process.env.GROQ_API_KEY;
  res.json({ ready, model: MODEL, provider: "groq" });
});

/** GET /api/chat/conversations */
router.get("/chat/conversations", async (_req, res) => {
  try {
    await connectMongo();
    const convs = await Conversation.find()
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    res.json(convs);
  } catch {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/** POST /api/chat/conversations */
router.post("/chat/conversations", async (req, res) => {
  const { title = "New Chat" } = req.body ?? {};
  try {
    await connectMongo();
    const conv = await Conversation.create({ title });
    res.status(201).json(conv);
  } catch {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/** DELETE /api/chat/conversations/:id */
router.delete("/chat/conversations/:id", async (req, res) => {
  try {
    await connectMongo();
    await Message.deleteMany({ conversationId: req.params.id });
    await Conversation.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/** GET /api/chat/conversations/:id/messages */
router.get("/chat/conversations/:id/messages", async (req, res) => {
  try {
    await connectMongo();
    const msgs = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/** POST /api/chat/conversations/:id/messages — SSE streaming via Groq */
router.post("/chat/conversations/:id/messages", async (req, res) => {
  const conversationId = req.params.id;

  const { content, context } = req.body as {
    content?: string;
    context?: {
      cityName?: string;
      provinceName?: string;
      regionName?: string;
      regionCode?: string;
      provinceCode?: string;
      cityCode?: string;
      preferredCrops?: string[];
      weather?: { temperature?: number; condition?: string; humidity?: number } | null;
    };
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  try {
    await connectMongo();

    // Save user message
    await Message.create({ conversationId, role: "user", content: content.trim() });

    // Load conversation history (last 20 messages for context window)
    const history = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const systemPrompt = buildSystemPrompt(context ?? {});

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(0, -1).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: content.trim() },
    ];

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: chatMessages,
      stream: true,
      temperature: 0.6,
      max_tokens: 2048,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;
      fullResponse += delta;
      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    }

    // Strip <think>...</think> reasoning blocks before saving to DB
    const cleanedResponse = fullResponse
      .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
      .trim();

    const savedContent = cleanedResponse || fullResponse.trim();

    if (savedContent) {
      await Message.create({ conversationId, role: "assistant", content: savedContent });

      // Auto-update conversation title and timestamp
      const conv = await Conversation.findById(conversationId);
      if (conv) {
        if (conv.title === "New Chat") {
          conv.title = content.trim().slice(0, 60) + (content.trim().length > 60 ? "…" : "");
        }
        conv.updatedAt = new Date();
        await conv.save();
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    const errStatus = err?.status ?? err?.statusCode ?? null;
    console.error("[chat] Groq error:", errStatus, errMsg, err?.error ?? "");
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: `AI error: ${errMsg}` })}\n\n`);
      res.end();
    } else {
      res.status(503).json({ error: "AI service unavailable. Please try again." });
    }
  }
});

export default router;
