import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreVertical, Trash2, FileText, Clock } from "lucide-react";
import type { Speech } from "@/pages/Speeches";
import { formatDistanceToNow } from "date-fns";

interface SpeechSidebarProps {
  speeches: Speech[];
  selectedSpeech: Speech | null;
  onSelectSpeech: (speech: Speech) => void;
  onNewSpeech: () => void;
  onDeleteSpeech: (id: string) => void;
  loading: boolean;
}

export function SpeechSidebar({
  speeches,
  selectedSpeech,
  onSelectSpeech,
  onNewSpeech,
  onDeleteSpeech,
  loading,
}: SpeechSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredSpeeches = speeches.filter(
    (speech) =>
      speech.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      speech.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSpeechTypeIcon = (type: string) => {
    switch (type) {
      case "keynote":
        return "🎤";
      case "workshop":
        return "🛠️";
      case "sermon":
        return "✝️";
      case "ted_style":
        return "💡";
      case "training":
        return "📚";
      default:
        return "📝";
    }
  };

  return (
    <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <Button onClick={onNewSpeech} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          New Speech
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search speeches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : filteredSpeeches.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {searchQuery ? "No speeches found" : "No speeches yet"}
            </div>
          ) : (
            filteredSpeeches.map((speech) => (
              <div
                key={speech.id}
                className={`group relative rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedSpeech?.id === speech.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                }`}
                onClick={() => onSelectSpeech(speech)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{getSpeechTypeIcon(speech.speech_type)}</span>
                      <span className="font-medium truncate text-sm">
                        {speech.title || "Untitled Speech"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {speech.topic || "No topic set"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(speech.status)}`}
                      >
                        {speech.status.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {speech.duration_minutes}m
                      </span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(speech.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {formatDistanceToNow(new Date(speech.updated_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Speech</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this speech? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  onDeleteSpeech(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
