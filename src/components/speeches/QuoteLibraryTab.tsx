import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit2, Trash2, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuoteItem {
  id: string;
  speaker_id: string;
  quote_text: string;
  attribution: string | null;
  source: string | null;
  tags: string[];
  created_at: string;
}

const TAG_OPTIONS = [
  "leadership",
  "motivation",
  "success",
  "failure",
  "change",
  "innovation",
  "teamwork",
  "perseverance",
  "wisdom",
  "humor",
  "faith",
  "courage",
  "growth",
  "mindset",
];

export function QuoteLibraryTab() {
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteItem | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    quote_text: "",
    attribution: "",
    source: "",
    tags: [] as string[],
  });

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("quote_library")
        .select("*")
        .eq("speaker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      toast({ title: "Error loading quotes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingQuote) {
        const { error } = await supabase
          .from("quote_library")
          .update({
            quote_text: formData.quote_text,
            attribution: formData.attribution || null,
            source: formData.source || null,
            tags: formData.tags,
          })
          .eq("id", editingQuote.id);

        if (error) throw error;
        toast({ title: "Quote updated" });
      } else {
        const { error } = await supabase.from("quote_library").insert({
          speaker_id: user.id,
          quote_text: formData.quote_text,
          attribution: formData.attribution || null,
          source: formData.source || null,
          tags: formData.tags,
        });

        if (error) throw error;
        toast({ title: "Quote added" });
      }

      setDialogOpen(false);
      resetForm();
      fetchQuotes();
    } catch (error) {
      console.error("Error saving quote:", error);
      toast({ title: "Error saving quote", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("quote_library").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Quote deleted" });
      fetchQuotes();
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast({ title: "Error deleting quote", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({ quote_text: "", attribution: "", source: "", tags: [] });
    setEditingQuote(null);
  };

  const openEdit = (quote: QuoteItem) => {
    setEditingQuote(quote);
    setFormData({
      quote_text: quote.quote_text,
      attribution: quote.attribution || "",
      source: quote.source || "",
      tags: quote.tags || [],
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

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.quote_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.attribution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Quote className="h-6 w-6" />
            Quote Library
          </h2>
          <p className="text-muted-foreground">
            Collect powerful quotes to enhance your speeches
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Quote
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search quotes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Quote className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {searchQuery ? "No quotes found" : "No quotes yet"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Add memorable quotes to reference in your speeches
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Quote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredQuotes.map((quote) => (
            <Card key={quote.id} className="group">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <blockquote className="text-lg italic border-l-4 border-primary/30 pl-4">
                      "{quote.quote_text}"
                    </blockquote>
                    {quote.attribution && (
                      <p className="text-sm font-medium mt-2">
                        — {quote.attribution}
                      </p>
                    )}
                    {quote.source && (
                      <p className="text-xs text-muted-foreground">
                        {quote.source}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(quote)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(quote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {quote.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingQuote ? "Edit Quote" : "Add New Quote"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Quote</Label>
              <Textarea
                value={formData.quote_text}
                onChange={(e) =>
                  setFormData({ ...formData, quote_text: e.target.value })
                }
                placeholder="Enter the quote..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Attribution</Label>
                <Input
                  value={formData.attribution}
                  onChange={(e) =>
                    setFormData({ ...formData, attribution: e.target.value })
                  }
                  placeholder="Who said it?"
                />
              </div>
              <div>
                <Label>Source (optional)</Label>
                <Input
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                  placeholder="Book, speech, interview..."
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Tags</Label>
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
            <Button onClick={handleSave} disabled={!formData.quote_text}>
              {editingQuote ? "Save Changes" : "Add Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
