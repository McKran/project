import { useState, useRef, useEffect } from "react";
import { useLocationStore } from "@/hooks/use-location";
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

export default function Chat() {
  const { location } = useLocationStore();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: conversations, isLoading: isListLoading } = useListOpenaiConversations(
    { query: { queryKey: getListOpenaiConversationsQueryKey() } }
  );

  const { data: activeConversation, isLoading: isActiveLoading } = useGetOpenaiConversation(
    activeId!,
    { query: { enabled: !!activeId, queryKey: getGetOpenaiConversationQueryKey(activeId!) } }
  );

  // Mutations
  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();

  // Effects
  useEffect(() => {
    // Auto-select first conversation if none selected
    if (conversations && conversations.length > 0 && !activeId && !isListLoading) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId, isListLoading]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, streamingContent]);

  // Handlers
  const handleNewChat = () => {
    createConv.mutate({ data: { title: "New Conversation" } }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setActiveId(newConv.id);
        setIsMobileMenuOpen(false);
      }
    });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeId === id) {
          setActiveId(null);
        }
      }
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    let targetId = activeId;
    
    // Create new conversation if none active
    if (!targetId) {
      try {
        const newConv = await createConv.mutateAsync({ data: { title: input.substring(0, 30) + "..." } });
        targetId = newConv.id;
        setActiveId(targetId);
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      } catch (err) {
        console.error("Failed to create conversation", err);
        return;
      }
    }

    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically add user message to cache
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
        body: JSON.stringify({ 
          content: userMessage,
          context: { location } // Pass location as context
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // keep incomplete line
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.done) break;
              if (json.content) {
                setStreamingContent(prev => prev + json.content);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(targetId) });
      }
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-muted/30 border-r">
      <div className="p-4 border-b">
        <Button onClick={handleNewChat} className="w-full gap-2" variant="default">
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isListLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : conversations?.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-4">No conversations yet</div>
          ) : (
            conversations?.map((conv) => (
              <div 
                key={conv.id}
                onClick={() => { setActiveId(conv.id); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-between p-3 text-sm rounded-md cursor-pointer transition-colors group
                  ${activeId === conv.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <span className="truncate pr-2">{conv.title}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${activeId === conv.id ? 'text-primary hover:text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
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

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8 flex bg-background rounded-xl overflow-hidden border shadow-sm animate-in fade-in duration-500">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0">
        <SidebarContent />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
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
          <Button variant="ghost" size="icon" onClick={handleNewChat}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
        >
          {!activeId && !isListLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 text-muted-foreground">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">AI Agronomist</h2>
              <p className="text-sm">Ask me about pest control, fertilizer application, weather impacts, or crop recommendations.</p>
              <Button onClick={handleNewChat} variant="outline" className="mt-4">Start a conversation</Button>
            </div>
          )}

          {isActiveLoading && activeId && (
            <div className="space-y-6">
              <Skeleton className="h-16 w-3/4 ml-auto rounded-xl rounded-tr-none" />
              <Skeleton className="h-32 w-3/4 rounded-xl rounded-tl-none" />
            </div>
          )}

          {activeConversation?.messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center
                ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/20 text-primary'}`}
              >
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Sprout className="h-4 w-4" />}
              </div>
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'}`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Sprout className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-none px-4 py-3 bg-muted text-sm leading-relaxed whitespace-pre-wrap">
                {streamingContent || <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t">
          <form 
            onSubmit={handleSend}
            className="flex items-end gap-2 max-w-3xl mx-auto relative"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your crops..."
              className="py-6 pr-12 rounded-full bg-muted/50 border-muted focus-visible:ring-primary"
              disabled={isStreaming}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1.5 bottom-1.5 h-9 w-9 rounded-full"
              disabled={!input.trim() || isStreaming}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground">AI can make mistakes. Verify important farming decisions.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
