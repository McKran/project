import { useState, useRef, useEffect, useCallback, memo, startTransition } from "react";
import { useLocationStore } from "@/hooks/use-location";
import { useSettings } from "@/hooks/use-settings";
import {
  useListOpenaiConversations, getListOpenaiConversationsQueryKey,
  useCreateOpenaiConversation,
  useGetOpenaiConversation, getGetOpenaiConversationQueryKey,
  useDeleteOpenaiConversation
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquarePlus, Send, Trash2, Sprout, User, Loader2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2 mt-1">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-bold mb-2 mt-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1 mt-1">{children}</h3>,
  code: ({ inline, children }: any) => inline
    ? <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
    : <pre className="bg-black/10 dark:bg-white/10 rounded p-2 text-xs font-mono overflow-x-auto mb-2 whitespace-pre-wrap"><code>{children}</code></pre>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80 mb-2">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline opacity-80 hover:opacity-100">{children}</a>,
  table: ({ children }: any) => <div className="overflow-x-auto mb-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
  th: ({ children }: any) => <th className="border border-current/20 px-2 py-1 font-bold text-left">{children}</th>,
  td: ({ children }: any) => <td className="border border-current/20 px-2 py-1">{children}</td>,
  hr: () => <hr className="border-current/20 my-2" />,
};

const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  );
});

const TYPING_DOTS = (
  <span className="flex gap-1 items-center h-5">
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:0ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:300ms]" />
  </span>
);

export default function Chat() {
  const { location } = useLocationStore();
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const hasAutoInitRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamBufferRef = useRef("");
  const rafRef = useRef<number>(0);

  const { data: conversations, isLoading: isListLoading } = useListOpenaiConversations(
    { query: { queryKey: getListOpenaiConversationsQueryKey(), staleTime: 30_000 } }
  );

  const { data: activeConversation, isLoading: isActiveLoading } = useGetOpenaiConversation(
    activeId!,
    { query: { enabled: !!activeId, queryKey: getGetOpenaiConversationQueryKey(activeId!), staleTime: Infinity } }
  );

  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();

  const flushBuffer = useCallback(() => {
    if (streamBufferRef.current) {
      const chunk = streamBufferRef.current;
      streamBufferRef.current = "";
      startTransition(() => setStreamingContent(prev => prev + chunk));
    }
  }, []);

  const streamWelcomeMessage = useCallback(async (convId: number) => {
    setIsStreaming(true);
    setStreamingContent("");
    streamBufferRef.current = "";

    try {
      const BASE = import.meta.env.BASE_URL;
      const res = await fetch(`${BASE}api/openai/conversations/${convId}/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          crops: settings.preferredCrops,
          targetMarket: settings.targetMarket,
          cityName: settings.cityName,
          regionName: settings.regionName || settings.stateName,
        }),
      });

      if (!res.body || !res.ok) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      const scheduleFlush = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flushBuffer);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop()!;
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.done) break;
              if (json.content) {
                streamBufferRef.current += json.content;
                scheduleFlush();
              }
            } catch {}
          }
        }
      }
      cancelAnimationFrame(rafRef.current);
      flushBuffer();
    } catch (err) {
      console.error("Welcome stream error:", err);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      streamBufferRef.current = "";
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
    }
  }, [location, settings, flushBuffer, queryClient]);

  useEffect(() => {
    if (isListLoading || hasAutoInitRef.current) return;

    if (conversations && conversations.length > 0 && !activeId) {
      startTransition(() => setActiveId(conversations[0].id));
      return;
    }

    if (conversations && conversations.length === 0 && !isInitializing) {
      hasAutoInitRef.current = true;
      setIsInitializing(true);
      createConv.mutate(
        { data: { title: "Welcome Session" } },
        {
          onSuccess: async (newConv) => {
            queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
            startTransition(() => setActiveId(newConv.id));
            setIsInitializing(false);
            await streamWelcomeMessage(newConv.id);
          },
          onError: () => {
            setIsInitializing(false);
          },
        }
      );
    }
  }, [conversations, activeId, isListLoading, isInitializing, createConv, queryClient, streamWelcomeMessage]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages?.length, isStreaming, scrollToBottom]);

  useEffect(() => {
    if (streamingContent) scrollToBottom();
  }, [streamingContent, scrollToBottom]);

  const handleNewChat = useCallback(() => {
    createConv.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        startTransition(() => {
          setActiveId(newConv.id);
          setIsMobileMenuOpen(false);
        });
      }
    });
  }, [createConv, queryClient]);

  const handleDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeId === id) startTransition(() => setActiveId(null));
      }
    });
  }, [deleteConv, queryClient, activeId]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    let targetId = activeId;
    if (!targetId) {
      try {
        const newConv = await createConv.mutateAsync({ data: { title: input.substring(0, 40) } });
        targetId = newConv.id;
        startTransition(() => setActiveId(targetId));
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      } catch {
        return;
      }
    }

    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    streamBufferRef.current = "";

    if (targetId) {
      queryClient.setQueryData(getGetOpenaiConversationQueryKey(targetId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            { id: Date.now(), role: "user", content: userMessage, createdAt: new Date().toISOString() }
          ]
        };
      });
    }

    try {
      const BASE = import.meta.env.BASE_URL;
      const res = await fetch(`${BASE}api/openai/conversations/${targetId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage, context: { location, currency: settings.currency, currentCrop: settings.preferredCrops[0] ?? null } }),
      });

      if (!res.body) throw new Error("No response body");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      const scheduleFlush = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(flushBuffer);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop()!;
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.done) break;
              if (json.content) {
                streamBufferRef.current += json.content;
                scheduleFlush();
              }
            } catch {}
          }
        }
      }
      cancelAnimationFrame(rafRef.current);
      flushBuffer();
    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      streamBufferRef.current = "";
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(targetId) });
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      }
    }
  }, [input, isStreaming, activeId, createConv, queryClient, location, flushBuffer]);

  const SidebarContent = memo(function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-muted/30 border-r">
        <div className="p-4 border-b">
          <Button onClick={handleNewChat} className="w-full gap-2" variant="default" disabled={createConv.isPending}>
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isListLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : conversations?.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-4">No conversations yet</div>
            ) : (
              conversations?.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => { startTransition(() => { setActiveId(conv.id); setIsMobileMenuOpen(false); }); }}
                  className={`flex items-center justify-between p-3 text-sm rounded-md cursor-pointer transition-colors group
                    ${activeId === conv.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  <span className="truncate pr-2">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${activeId === conv.id ? 'text-primary hover:text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                    onClick={(e) => handleDelete(e, conv.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  });

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8 flex bg-background rounded-xl overflow-hidden border shadow-sm">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0">
        <SidebarContent />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b bg-card">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <span className="font-medium text-sm truncate px-2">
            {activeConversation?.title || "New Chat"}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNewChat} disabled={createConv.isPending}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 overscroll-contain"
        >
          {!activeId && (isListLoading || isInitializing) && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 text-muted-foreground">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Starting your session…</h2>
              <p className="text-sm">Your AI Agronomist is preparing a personalized welcome.</p>
            </div>
          )}

          {isActiveLoading && activeId && (
            <div className="space-y-5">
              <Skeleton className="h-14 w-3/4 ml-auto rounded-xl rounded-tr-none" />
              <Skeleton className="h-28 w-3/4 rounded-xl rounded-tl-none" />
            </div>
          )}

          {activeConversation?.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isStreaming && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Sprout className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-none px-4 py-3 bg-muted text-sm leading-relaxed">
                {streamingContent
                  ? <MarkdownMessage content={streamingContent} />
                  : TYPING_DOTS
                }
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-background border-t">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 max-w-3xl mx-auto relative"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              placeholder="Ask about crops, prices, weather..."
              className="py-5 pr-12 rounded-full bg-muted/50 border-muted focus-visible:ring-primary text-sm"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1.5 h-8 w-8 rounded-full"
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
          </form>
          <p className="text-center mt-1.5 text-[10px] text-muted-foreground">
            AI can make mistakes. Verify important decisions with local experts.
          </p>
        </div>
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ msg }: { msg: { id: number; role: string; content: string } }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center
        ${isUser ? "bg-secondary" : "bg-primary/20 text-primary"}`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sprout className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted rounded-tl-none"}`}
      >
        {isUser
          ? <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          : <MarkdownMessage content={msg.content} />
        }
      </div>
    </div>
  );
});
