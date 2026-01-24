import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CoachMessage } from "@/components/coach/CoachMessage";
import { CoachSidebar } from "@/components/coach/CoachSidebar";
import { CoachQuickStart } from "@/components/coach/CoachQuickStart";


interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  mode: string | null;
  messages: Message[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface CoachUsage {
  used: number;
  limit: number;
}

const Coach = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<CoachUsage>({ used: 0, limit: 20 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    // Mark coach as visited for onboarding
    localStorage.setItem("onboarding_coach_visited", "true");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load in parallel
    const [profileRes, conversationsRes, usageRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase
        .from("coach_conversations")
        .select("*")
        .eq("speaker_id", session.user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("coach_usage")
        .select("message_count")
        .eq("speaker_id", session.user.id)
        .eq("year_month", new Date().toISOString().slice(0, 7))
        .maybeSingle(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (conversationsRes.data) {
      const convs = conversationsRes.data.map((c) => ({
        ...c,
        messages: Array.isArray(c.messages) ? (c.messages as unknown as Message[]) : [],
      }));
      setConversations(convs);
    }
    if (usageRes.data) {
      setUsage({ used: usageRes.data.message_count, limit: 20 });
    }
  };

  const createNewConversation = async (mode?: string, initialPrompt?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const title = mode 
      ? mode.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "New Conversation";

    const { data, error } = await supabase
      .from("coach_conversations")
      .insert({
        speaker_id: session.user.id,
        title,
        mode: mode || null,
        messages: [],
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create conversation");
      return;
    }

    const newConv: Conversation = {
      ...data,
      messages: [],
    };

    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversation(newConv);
    setMessages([]);
    setSelectedMode(mode || null);

    if (initialPrompt) {
      setInput(initialPrompt);
    }
  };

  const selectConversation = (conv: Conversation) => {
    setCurrentConversation(conv);
    setMessages(conv.messages);
    setSelectedMode(conv.mode);
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from("coach_conversations")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete conversation");
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
    }
    toast.success("Conversation deleted");
  };

  const toggleFavorite = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("coach_conversations")
      .update({ is_favorite: !currentValue })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_favorite: !currentValue } : c))
    );
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    if (usage.used >= usage.limit) {
      toast.error("You've reached your monthly limit of 20 coach messages");
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Create conversation if needed
    let convId = currentConversation?.id;
    if (!convId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("coach_conversations")
        .insert({
          speaker_id: session.user.id,
          title: userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? "..." : ""),
          mode: selectedMode,
          messages: JSON.parse(JSON.stringify([userMessage])),
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to save conversation");
        setIsStreaming(false);
        return;
      }

      convId = data.id;
      const newConv: Conversation = { ...data, messages: [userMessage] };
      setCurrentConversation(newConv);
      setConversations((prev) => [newConv, ...prev]);
    } else {
      // Update existing conversation
      await supabase
        .from("coach_conversations")
        .update({ messages: JSON.parse(JSON.stringify(newMessages)), updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          mode: selectedMode,
          speakerProfile: profile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402 && errorData.limit) {
          setUsage({ used: errorData.used, limit: errorData.limit });
          toast.error("Monthly coaching limit reached");
        } else {
          toast.error(errorData.error || "Failed to get response");
        }
        setIsStreaming(false);
        return;
      }

      // Stream response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantMessage };
                return updated;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Update usage
      setUsage((prev) => ({ ...prev, used: prev.used + 1 }));

      // Save final messages
      const finalMessages = [...newMessages, { role: "assistant" as const, content: assistantMessage }];
      await supabase
        .from("coach_conversations")
        .update({ messages: JSON.parse(JSON.stringify(finalMessages)), updated_at: new Date().toISOString() })
        .eq("id", convId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c
        )
      );
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to get coaching response");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleQuickStart = (mode: string, prompt: string) => {
    if (currentConversation) {
      setSelectedMode(mode);
      setInput(prompt);
    } else {
      createNewConversation(mode, prompt);
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Sidebar */}
        <CoachSidebar
          conversations={conversations}
          currentConversation={currentConversation}
          onSelect={selectConversation}
          onNew={() => createNewConversation()}
          onDelete={deleteConversation}
          onToggleFavorite={toggleFavorite}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-violet-600" />
              <div>
                <h1 className="text-xl font-bold">AI Speaker Coach</h1>
                <p className="text-sm text-muted-foreground">
                  Get personalized feedback on pitches, practice Q&A, and improve your speaking business
                </p>
              </div>
            </div>
            <Badge variant={usage.used >= usage.limit ? "destructive" : "secondary"}>
              {usage.used}/{usage.limit} messages this month
            </Badge>
          </div>

          {/* Chat Container */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {messages.length === 0 && !currentConversation ? (
              <CoachQuickStart onSelect={handleQuickStart} />
            ) : (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((msg, i) => (
                    <CoachMessage
                      key={i}
                      message={msg}
                      onCopy={() => copyMessage(msg.content)}
                      isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            )}

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedMode === "review-pitch"
                      ? "Paste your pitch email here for feedback..."
                      : selectedMode === "practice-qa"
                      ? "I'm ready to practice - start asking me questions..."
                      : "Ask your AI coach anything about speaking..."
                  }
                  className="min-h-[60px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isStreaming || usage.used >= usage.limit}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming || usage.used >= usage.limit}
                  className="bg-violet-600 hover:bg-violet-700 px-6"
                >
                  {isStreaming ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {selectedMode && (
                <div className="max-w-3xl mx-auto mt-2">
                  <Badge variant="outline" className="text-xs">
                    Mode: {selectedMode.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Coach;
