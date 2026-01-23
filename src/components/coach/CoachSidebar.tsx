import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MessageSquare,
  Star,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface CoachSidebarProps {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentValue: boolean) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CoachSidebar({
  conversations,
  currentConversation,
  onSelect,
  onNew,
  onDelete,
  onToggleFavorite,
  isOpen,
  onToggle,
}: CoachSidebarProps) {
  const favorites = conversations.filter((c) => c.is_favorite);
  const recent = conversations.filter((c) => !c.is_favorite);

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="icon" onClick={onToggle}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNew}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col border-r pr-4">
      <div className="flex items-center justify-between mb-4">
        <Button onClick={onNew} className="flex-1 bg-violet-600 hover:bg-violet-700">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggle} className="ml-2">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {favorites.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Star className="h-3 w-3" /> Favorites
            </p>
            <div className="space-y-1">
              {favorites.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={currentConversation?.id === conv.id}
                  onSelect={() => onSelect(conv)}
                  onDelete={() => onDelete(conv.id)}
                  onToggleFavorite={() => onToggleFavorite(conv.id, conv.is_favorite)}
                />
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent</p>
            <div className="space-y-1">
              {recent.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={currentConversation?.id === conv.id}
                  onSelect={() => onSelect(conv)}
                  onDelete={() => onDelete(conv.id)}
                  onToggleFavorite={() => onToggleFavorite(conv.id, conv.is_favorite)}
                />
              ))}
            </div>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onToggleFavorite,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Card
      className={`p-2 cursor-pointer group transition-colors ${
        isActive ? "bg-violet-100 dark:bg-violet-900/30 border-violet-300" : "hover:bg-muted"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{conversation.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Star
              className={`h-3 w-3 ${conversation.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {conversation.mode && (
        <Badge variant="secondary" className="text-xs mt-1">
          {conversation.mode.split("-").join(" ")}
        </Badge>
      )}
    </Card>
  );
}
