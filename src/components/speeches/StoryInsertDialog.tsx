import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sparkles, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Story {
  id: string;
  title: string;
  story_text: string;
  tags: string[];
  times_used: number;
}

interface StoryInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (storyText: string) => void;
  speechContext: {
    topic: string;
    keyMessage: string;
  };
}

export function StoryInsertDialog({
  open,
  onOpenChange,
  onInsert,
  speechContext,
}: StoryInsertDialogProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedStoryId, setSuggestedStoryId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchStories();
    }
  }, [open]);

  const fetchStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("story_bank")
        .select("id, title, story_text, tags, times_used")
        .eq("speaker_id", user.id)
        .order("times_used", { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error("Error fetching stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const suggestStory = async () => {
    if (stories.length === 0) return;
    
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-speech-content", {
        body: {
          action: "suggest_story",
          context: {
            stories: stories.map((s) => ({ id: s.id, title: s.title, tags: s.tags })),
            topic: speechContext.topic,
            currentSection: "current section",
            keyMessage: speechContext.keyMessage,
          },
        },
      });

      if (error) throw error;
      
      if (data.recommendedStoryId) {
        setSuggestedStoryId(data.recommendedStoryId);
        toast({ title: "Story suggested!", description: data.reason });
      } else {
        toast({ title: "No perfect match found", description: "Browse your stories manually" });
      }
    } catch (error) {
      console.error("Error suggesting story:", error);
      toast({ title: "Failed to suggest story", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const handleSelect = async (story: Story) => {
    // Update usage count
    try {
      await supabase
        .from("story_bank")
        .update({ times_used: stories.find(s => s.id === story.id)?.times_used || 0 + 1 })
        .eq("id", story.id);
    } catch (error) {
      console.error("Error updating story usage:", error);
    }

    onInsert(story.story_text);
  };

  const filteredStories = stories.filter(
    (story) =>
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.story_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Insert Story
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={suggestStory}
              disabled={suggesting || stories.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {suggesting ? "Finding..." : "Suggest"}
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredStories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? "No stories match your search"
                  : "No stories in your bank yet"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStories.map((story) => (
                  <Card
                    key={story.id}
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${
                      suggestedStoryId === story.id
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => handleSelect(story)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{story.title}</h4>
                            {suggestedStoryId === story.id && (
                              <Badge className="bg-primary">Suggested</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {story.story_text}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {story.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button size="sm">Insert</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
