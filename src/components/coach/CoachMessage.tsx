import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Send, User, Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CoachMessageProps {
  message: Message;
  onCopy: () => void;
  isStreaming?: boolean;
}

export function CoachMessage({ message, onCopy, isStreaming }: CoachMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-violet-600 text-white"
            : "bg-gradient-to-br from-violet-400 to-violet-600 text-white"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      <Card
        className={`flex-1 p-4 max-w-[85%] ${
          isUser
            ? "bg-violet-600 text-white border-violet-600"
            : "bg-card"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.content ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            
            {isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-violet-600 animate-pulse ml-1" />
            )}
          </div>
        )}

        {!isUser && message.content && !isStreaming && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Button size="sm" variant="ghost" onClick={onCopy}>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button size="sm" variant="ghost">
              <Send className="h-3 w-3 mr-1" />
              Use in Pitch
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
