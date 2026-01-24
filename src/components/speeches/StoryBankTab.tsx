import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Story {
  id: string;
  speaker_id: string;
  title: string;
  story_text: string;
  tags: string[];
  used_in_speeches: string[];
  times_used: number;
  created_at: string;
}

const TAG_OPTIONS = [
  "funny",
  "emotional",
  "business",
  "failure",
  "success",
  "personal",
  "inspirational",
  "cautionary",
  "transformation",
  "leadership",
  "teamwork",
  "innovation",
  "resilience",
  "family",
  "childhood",
  "career",
  "lesson",
];

export function StoryBankTab() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    story_text: "",
    tags: [] as string[],
  });

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("story_bank")
        .select("*")
        .eq("speaker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error("Error fetching stories:", error);
      toast({ title: "Error loading stories", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingStory) {
        const { error } = await supabase
          .from("story_bank")
          .update({
            title: formData.title,
            story_text: formData.story_text,
            tags: formData.tags,
          })
          .eq("id", editingStory.id);

        if (error) throw error;
        toast({ title: "Story updated" });
      } else {
        const { error } = await supabase.from("story_bank").insert({
          speaker_id: user.id,
          title: formData.title,
          story_text: formData.story_text,
          tags: formData.tags,
        });

        if (error) throw error;
        toast({ title: "Story added" });
      }

      setDialogOpen(false);
      resetForm();
      fetchStories();
    } catch (error) {
      console.error("Error saving story:", error);
      toast({ title: "Error saving story", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("story_bank").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Story deleted" });
      fetchStories();
    } catch (error) {
      console.error("Error deleting story:", error);
      toast({ title: "Error deleting story", variant: "destructive" });
    }
  };

  const suggestTags = async () => {
    if (!formData.story_text) return;
    
    setSuggestingTags(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-speech-content", {
        body: {
          action: "suggest_tags",
          params: { storyText: formData.story_text },
        },
      });

      if (error) throw error;
      if (data.tags) {
        setFormData({ ...formData, tags: data.tags });
        toast({ title: "Tags suggested!" });
      }
    } catch (error) {
      console.error("Error suggesting tags:", error);
      toast({ title: "Failed to suggest tags", variant: "destructive" });
    } finally {
      setSuggestingTags(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", story_text: "", tags: [] });
    setEditingStory(null);
  };

  const openEdit = (story: Story) => {
    setEditingStory(story);
    setFormData({
      title: story.title,
      story_text: story.story_text,
      tags: story.tags || [],
    });
    setDialogOpen(true);
  };

  const toggleTag = (tag: string) => {
    if (formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  const filteredStories = stories.filter(
    (story) =>
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.story_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Story Bank
          </h2>
          <p className="text-muted-foreground">
            Save your best stories to use across speeches
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Story
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filteredStories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {searchQuery ? "No stories found" : "No stories yet"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Add stories from your experiences to enrich your speeches
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Story
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredStories.map((story) => (
            <Card key={story.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{story.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(story)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(story.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {story.story_text}
                </p>
                <div className="flex flex-wrap gap-1">
                  {story.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {story.times_used > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Used {story.times_used} time{story.times_used !== 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingStory ? "Edit Story" : "Add New Story"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Give your story a memorable title"
              />
            </div>

            <div>
              <Label>Story</Label>
              <Textarea
                value={formData.story_text}
                onChange={(e) => setFormData({ ...formData, story_text: e.target.value })}
                placeholder="Write your story here..."
                rows={8}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Tags</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={suggestTags}
                  disabled={!formData.story_text || suggestingTags}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {suggestingTags ? "Suggesting..." : "Suggest Tags"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.title || !formData.story_text}
            >
              {editingStory ? "Save Changes" : "Add Story"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
