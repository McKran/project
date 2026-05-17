/**
 * AI Chat Route — DeepSeek via Ollama (local, no external API)
 *
 * Uses DeepSeek running locally through Ollama's REST API.
 * Specialized for agriculture assistance only.
 * Conversation memory stored in PostgreSQL.
 *
 * No openai package required — uses fetch() against Ollama directly.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const OLLAMA_BASE = "http://localhost:11434";
const DEEPSEEK_MODEL = "deepseek-r1:1.5b";

function buildSystemPrompt(ctx: {
  cityName: string;
  provinceName: string;
  regionName: string;
  regionCode: string;
  provinceCode: string;
  cityCode: string;
  preferredCrops: string[];
}): string {
  const location = [ctx.cityName, ctx.provinceName, ctx.regionName, "Philippines"]
    .filter(Boolean)
    .join(", ");
  const crops = ctx.preferredCrops.length > 0 ? ctx.preferredCrops.join(", ") : "general crops";

  return `You are AgriAssist AI, an expert agricultural advisor exclusively serving Filipino farmers.

FARMER PROFILE:
- Location: ${location}
  - Region Code: ${ctx.regionCode || "—"}
  - Province Code: ${ctx.provinceCode || "—"}
  - City/Municipality Code: ${ctx.cityCode || "—"}
- Primary Crops: ${crops}

YOUR ROLE:
You provide expert, practical agriculture guidance ONLY. You specialize in:
1. Crop advice (planting, care, variety selection for the farmer's specific PSGC location and climate)
2. Pest and disease diagnosis (identification, treatment, prevention)
3. Fertilizer scheduling (nutrient management, timing, rates)
4. Weather interpretation (how current/forecasted weather affects the farmer's crops)
5. Farm planning guidance (season planning, crop rotation, intercropping)
6. Market explanation (understanding price data, when to sell, price trends)

STRICT RULES:
- ONLY answer questions about agriculture, farming, crops, soil, weather for farming, pests, fertilizers, and market prices for agricultural commodities.
- If asked about anything unrelated to agriculture, respond: "I'm specialized for agricultural guidance only. Please ask me about your crops, farming practices, pests, fertilizers, weather, or market prices."
- Always tailor advice to the farmer's specific PSGC location (${location}).
- Always consider the farmer's crop profile (${crops}) when giving advice.
- Give concise, practical, actionable answers.
- Use Filipino farming context (Philippine climate, seasons, local pest conditions).
- Provide structured responses when appropriate (numbered steps, bullet points).
- Do not hallucinate — if unsure, say so and recommend consulting a local agronomist.

Respond in English. Keep responses focused and practical.`;
}

async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkModelAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).some((m) => (m.name ?? "").startsWith("deepseek-r1"));
  } catch {
    return false;
  }
}

/**
 * GET /api/chat/status
 */
router.get("/chat/status", async (_req, res) => {
  const ollamaUp = await checkOllamaAvailable();
  const modelReady = ollamaUp ? await checkModelAvailable() : false;
  res.json({ ollamaRunning: ollamaUp, modelReady, model: DEEPSEEK_MODEL });
});

/**
 * GET /api/chat/conversations
 */
router.get("/chat/conversations", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(50);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * POST /api/chat/conversations
 */
router.post("/chat/conversations", async (req, res) => {
  const { title = "New Chat" } = req.body ?? {};
  try {
    const [conv] = await db.insert(conversations).values({ title }).returning();
    res.status(201).json(conv);
  } catch {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 */
router.delete("/chat/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 */
router.get("/chat/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message and stream DeepSeek response via SSE.
 */
router.post("/chat/conversations/:id/messages", async (req, res) => {
  const conversationId = parseInt(req.params.id);
  if (isNaN(conversationId)) {
    return res.status(400).json({ error: "Invalid conversation id" });
  }

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
    };
  };

  if (!content?.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const ollamaUp = await checkOllamaAvailable();
  if (!ollamaUp) {
    return res.status(503).json({
      error: "DeepSeek AI is starting up. Please wait a moment and try again.",
      ollamaRunning: false,
    });
  }

  try {
    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: content.trim(),
    });

    // Load conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const systemPrompt = buildSystemPrompt({
      cityName: context?.cityName ?? "",
      provinceName: context?.provinceName ?? "",
      regionName: context?.regionName ?? "",
      regionCode: context?.regionCode ?? "",
      provinceCode: context?.provinceCode ?? "",
      cityCode: context?.cityCode ?? "",
      preferredCrops: context?.preferredCrops ?? [],
    });

    const chatMessages = [
      { role: "system", content: systemPrompt },
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

    // Call Ollama streaming chat API
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: chatMessages,
        stream: true,
        options: { temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      const errText = await ollamaRes.text().catch(() => "");
      const isModelMissing = errText.includes("model") && errText.includes("not found");
      res.write(
        `data: ${JSON.stringify({
          error: isModelMissing
            ? "DeepSeek model is still downloading. Please wait a few minutes."
            : "AI response failed. Please try again.",
        })}\n\n`
      );
      res.end();
      return;
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };
          if (chunk.error) {
            res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
            break;
          }
          const delta = chunk.message?.content ?? "";
          if (delta) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
          if (chunk.done) break;
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    // Strip DeepSeek-R1 <think> reasoning blocks before saving to DB
    const cleanedResponse = fullResponse
      .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
      .trimStart();

    // Save assistant message
    if (cleanedResponse) {
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: cleanedResponse,
      });

      // Update conversation title if it's still "New Chat"
      const conv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (conv[0]?.title === "New Chat") {
        const title = content.trim().slice(0, 60) + (content.trim().length > 60 ? "…" : "");
        await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
      }
    } else if (fullResponse && !cleanedResponse) {
      // Only think blocks, no actual response — save a note
      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: "I couldn't formulate a response for that. Could you rephrase your farming question?",
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          error: msg.includes("timeout")
            ? "AI response timed out. Try a shorter question."
            : "AI connection lost. Please try again.",
        })}\n\n`
      );
      res.end();
    } else {
      res.status(503).json({ error: "AI service unavailable." });
    }
  }
});

export default router;
