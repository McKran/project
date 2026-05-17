import { useState, useRef, useEffect, useCallback } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, Plus, Trash2, Loader2,
  Bot, User, Sprout, AlertCircle, Wifi, WifiOff,
  ChevronLeft, Leaf
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface ChatStatus {
  ollamaRunning: boolean;
  modelReady: boolean;
  model: string;
}

const AGRICULTURE_STARTERS = [
  "What are the best rice varieties for my region?",
  "How do I identify and treat bacterial blight on rice?",
  "When should I apply fertilizer for corn?",
  "How does the current weather affect my crops?",
  "What is the best planting schedule for this season?",
  "How do I control fall armyworm infestation?",
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.match(/^\d+\.\s/)) {
          return <p key={i} className="pl-2">{line}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <p key={i} className="pl-2 flex gap-1.5"><span className="text-primary/60 shrink-0">•</span><span>{line.slice(2)}</span></p>;
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="font-bold text-base">{line.slice(2)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="font-semibold">{line.slice(3)}</p>;
        }
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function Chat() {
  const { settings } = useSettings();
  const [, navigate] = useLocation();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, scrollToBottom]);

  // Check Ollama/DeepSeek status
  useEffect(() => {
    async function checkStatus() {
      setStatusLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/chat/status`);
        if (res.ok) setStatus(await res.json());
      } catch {}
      setStatusLoading(false);
    }
    checkStatus();
    const id = setInterval(checkStatus, 15000);
    return () => clearInterval(id);
  }, []);

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch(`${BASE_URL}/api/chat/conversations`);
        if (res.ok) setConversations(await res.json());
      } catch {}
    }
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId == null) { setMessages([]); return; }
    async function loadMessages() {
      try {
        const res = await fetch(`${BASE_URL}/api/chat/conversations/${activeConversationId}/messages`);
        if (res.ok) setMessages(await res.json());
      } catch {}
    }
    loadMessages();
  }, [activeConversationId]);

  const createConversation = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) return;
      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      setShowSidebar(false);
    } catch {}
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${BASE_URL}/api/chat/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch {}
  };

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || streaming) return;

    setError(null);

    // Ensure we have an active conversation
    let convId = activeConversationId;
    if (convId == null) {
      try {
        const res = await fetch(`${BASE_URL}/api/chat/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        if (!res.ok) { setError("Failed to create conversation."); return; }
        const conv: Conversation = await res.json();
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
        convId = conv.id;
      } catch {
        setError("Failed to create conversation.");
        return;
      }
    }

    // Add user message optimistically
    const userMsg: Message = {
      id: Date.now(),
      conversationId: convId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");
    setIsThinking(false);

    const context = {
      cityName: settings.cityName,
      provinceName: settings.provinceName,
      regionName: settings.regionName,
      regionCode: settings.regionCode,
      provinceCode: settings.provinceCode,
      cityCode: settings.cityCode,
      preferredCrops: settings.preferredCrops,
    };

    try {
      const abort = new AbortController();
      abortRef.current = abort;

      const res = await fetch(`${BASE_URL}/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, context }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? "AI is not available. Please wait a moment.");
        setStreaming(false);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let rawFull = "";
      let displayFull = "";
      let inThinkBlock = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.error) { setError(ev.error); break; }
            if (ev.done) break;
            if (ev.content) {
              rawFull += ev.content;
              // Handle DeepSeek-R1 <think> reasoning blocks
              if (rawFull.includes("<think>") && !rawFull.includes("</think>")) {
                inThinkBlock = true;
                setIsThinking(true);
              } else if (inThinkBlock && rawFull.includes("</think>")) {
                inThinkBlock = false;
                setIsThinking(false);
                // Strip everything up to and including </think> for display
                displayFull = rawFull.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trimStart();
              } else if (!inThinkBlock) {
                displayFull = rawFull.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trimStart();
              }
              setStreamingContent(displayFull);
            }
          } catch {}
        }
      }
      // Final clean of display content
      displayFull = rawFull.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trimStart();

      // Commit assistant message (use cleaned displayFull without <think> blocks)
      if (displayFull) {
        const assistantMsg: Message = {
          id: Date.now() + 1,
          conversationId: convId,
          role: "assistant",
          content: displayFull,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId && c.title === "New Chat"
              ? { ...c, title: text.slice(0, 50) + (text.length > 50 ? "…" : "") }
              : c
          )
        );
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Connection lost. Please try again.");
      }
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setIsThinking(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasPsgcLocation = !!(settings.regionCode && settings.provinceCode);

  return (
    <div className="flex h-full gap-4 -m-4 md:-m-6 lg:-m-8">
      {/* Sidebar */}
      <aside
        className={`
          flex flex-col border-r bg-card/50
          transition-all duration-200
          ${showSidebar ? "w-64 shrink-0" : "w-0 overflow-hidden"}
          md:w-64 md:overflow-visible md:shrink-0
        `}
      >
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">AI Chat</span>
          </div>
          <Button size="sm" variant="ghost" onClick={createConversation} className="h-7 w-7 p-0 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Status indicator */}
        <div className="px-3 py-2 border-b">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking AI…
            </div>
          ) : status?.modelReady ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <Wifi className="h-3 w-3" />
              <span>DeepSeek ready</span>
            </div>
          ) : status?.ollamaRunning ? (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading model…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
              <WifiOff className="h-3 w-3" />
              <span>AI starting up…</span>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">
                Start a new chat to ask your farming questions.
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversationId(conv.id); setShowSidebar(false); }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors group ${
                    activeConversationId === conv.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/60 text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate text-xs">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-rose-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Farm context pill */}
        {hasPsgcLocation && (
          <div className="p-3 border-t">
            <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-xl">
              <Leaf className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                <div className="font-medium text-primary/80">{settings.cityName || settings.provinceName}</div>
                <div>{settings.preferredCrops.slice(0, 3).join(", ")}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 p-0">

        {/* Mobile sidebar toggle */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b">
          <button onClick={() => setShowSidebar((v) => !v)} className="p-1.5 rounded-lg hover:bg-muted">
            <ChevronLeft className={`h-4 w-4 transition-transform ${showSidebar ? "rotate-0" : "rotate-180"}`} />
          </button>
          <span className="text-sm font-medium">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title ?? "Chat"
              : "AI Farming Assistant"}
          </span>
        </div>

        {/* PSGC warning */}
        {!hasPsgcLocation && (
          <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Location not set. </span>
              Your location is used to personalize farming advice.{" "}
              <button
                onClick={() => navigate("/settings")}
                className="underline font-medium hover:no-underline"
              >
                Go to Settings
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          {activeConversationId == null && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sprout className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-1">AgriAssist AI</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Powered by DeepSeek — your local AI farming advisor.
                  Ask about crops, pests, fertilizers, or market prices.
                </p>
              </div>

              {!status?.modelReady && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>DeepSeek AI is starting up — this may take a moment on first run.</span>
                </div>
              )}

              <div className="w-full max-w-md">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
                  Try asking
                </p>
                <div className="grid gap-2">
                  {AGRICULTURE_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      onClick={() => { createConversation().then(() => { setInput(starter); }); sendMessage(starter); }}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border hover:bg-muted/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted/60 border rounded-tl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownText text={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                <div className="flex gap-3 justify-start">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-[80%] space-y-2">
                    {/* Thinking indicator */}
                    {isThinking && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border rounded-xl px-3 py-2">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0 text-primary/60" />
                        <span className="italic">DeepSeek is reasoning…</span>
                      </div>
                    )}
                    {/* Response content */}
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-muted/60 border">
                      {streamingContent ? (
                        <MarkdownText text={streamingContent} />
                      ) : !isThinking ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 max-w-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t bg-card/50">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder={
                status?.modelReady
                  ? "Ask about your crops, pests, fertilizers, or weather…"
                  : "DeepSeek AI is starting up…"
              }
              rows={1}
              className="flex-1 resize-none px-4 py-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 min-h-[44px] max-h-[120px]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              className="h-11 w-11 p-0 rounded-xl shrink-0"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Powered by DeepSeek · Local AI · Agriculture guidance only
          </p>
        </div>
      </div>
    </div>
  );
}
