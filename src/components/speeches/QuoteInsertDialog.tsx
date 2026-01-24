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
import { Search, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuoteItem {
  id: string;
  quote_text: string;
  attribution: string | null;
  source: string | null;
  tags: string[];
}

interface QuoteInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (quoteText: string, attribution: string) => void;
}

export function QuoteInsertDialog({
  open,
  onOpenChange,
  onInsert,
}: QuoteInsertDialogProps) {
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchQuotes();
    }
  }, [open]);

  const fetchQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("quote_library")
        .select("id, quote_text, attribution, source, tags")
        .eq("speaker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Error fetching quotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (quote: QuoteItem) => {
    onInsert(quote.quote_text, quote.attribution || "Unknown");
  };

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.quote_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.attribution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5" />
            Insert Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? "No quotes match your search"
                  : "No quotes in your library yet"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuotes.map((quote) => (
                  <Card
                    key={quote.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSelect(quote)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <blockquote className="italic text-muted-foreground border-l-2 border-primary/30 pl-3">
                            "{quote.quote_text}"
                          </blockquote>
                          {quote.attribution && (
                            <p className="text-sm font-medium mt-2">
                              — {quote.attribution}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {quote.tags.map((tag) => (
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
