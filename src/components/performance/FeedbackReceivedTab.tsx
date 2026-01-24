import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Star, ChevronDown, Search, MessageSquare, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Feedback {
  id: string;
  event_name: string;
  event_date: string | null;
  respondent_name: string | null;
  respondent_role: string | null;
  overall_rating: number | null;
  content_rating: number | null;
  delivery_rating: number | null;
  engagement_rating: number | null;
  would_recommend: boolean | null;
  what_worked_well: string | null;
  what_to_improve: string | null;
  testimonial_quote: string | null;
  can_use_as_testimonial: boolean | null;
  submitted_at: string | null;
}

export function FeedbackReceivedTab() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("event_feedback")
        .select("*")
        .eq("speaker_id", user.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      toast({ title: "Error loading feedback", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addToTestimonials = async (item: Feedback) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("testimonials").insert({
        speaker_id: user.id,
        quote: item.testimonial_quote || item.what_worked_well || "",
        author_name: item.respondent_name || "Anonymous",
        author_title: item.respondent_role,
        event_name: item.event_name,
        event_date: item.event_date,
        rating: item.overall_rating,
        source: "feedback",
        received_at: item.submitted_at,
      });

      if (error) throw error;
      toast({ title: "Added to testimonials!" });
    } catch (error) {
      console.error("Error adding testimonial:", error);
      toast({ title: "Error adding testimonial", variant: "destructive" });
    }
  };

  const StarDisplay = ({ rating }: { rating: number | null }) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredFeedback = feedback.filter((item) => {
    const matchesSearch =
      item.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.respondent_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRating =
      ratingFilter === "all" ||
      (ratingFilter === "high" && (item.overall_rating || 0) >= 4) ||
      (ratingFilter === "low" && (item.overall_rating || 0) < 4);

    return matchesSearch && matchesRating;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search feedback..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="high">4+ Stars</SelectItem>
            <SelectItem value="low">Below 4 Stars</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredFeedback.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No feedback received yet</h3>
            <p className="text-muted-foreground text-center">
              Send feedback requests to start collecting responses
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map((item) => {
            const isHighRated = (item.overall_rating || 0) >= 4;
            const hasTestimonialPotential = isHighRated && (item.can_use_as_testimonial || item.what_worked_well);

            return (
              <Collapsible
                key={item.id}
                open={expandedId === item.id}
                onOpenChange={(open) => setExpandedId(open ? item.id : null)}
              >
                <Card className={hasTestimonialPotential ? "border-primary/30" : ""}>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{item.event_name}</h3>
                            {hasTestimonialPotential && (
                              <Badge className="bg-primary/10 text-primary">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Great testimonial!
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <StarDisplay rating={item.overall_rating} />
                            <span className="text-sm text-muted-foreground">
                              {item.respondent_name || "Anonymous"}
                            </span>
                            {item.submitted_at && (
                              <span className="text-sm text-muted-foreground">
                                • {format(new Date(item.submitted_at), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            expandedId === item.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t">
                      {/* Rating Details */}
                      <div className="grid grid-cols-3 gap-4 pt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Content</p>
                          <StarDisplay rating={item.content_rating} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Delivery</p>
                          <StarDisplay rating={item.delivery_rating} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Engagement</p>
                          <StarDisplay rating={item.engagement_rating} />
                        </div>
                      </div>

                      {item.would_recommend !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Would recommend:</span>
                          <Badge variant={item.would_recommend ? "default" : "secondary"}>
                            {item.would_recommend ? "Yes" : "No"}
                          </Badge>
                        </div>
                      )}

                      {item.what_worked_well && (
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-1">
                            What worked well:
                          </p>
                          <p className="text-sm">{item.what_worked_well}</p>
                        </div>
                      )}

                      {item.what_to_improve && (
                        <div>
                          <p className="text-sm font-medium text-yellow-600 mb-1">
                            Areas to improve:
                          </p>
                          <p className="text-sm">{item.what_to_improve}</p>
                        </div>
                      )}

                      {item.testimonial_quote && (
                        <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary">
                          <p className="text-sm italic">"{item.testimonial_quote}"</p>
                          {item.can_use_as_testimonial && (
                            <p className="text-xs text-muted-foreground mt-2">
                              ✓ Approved for public use
                            </p>
                          )}
                        </div>
                      )}

                      {hasTestimonialPotential && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToTestimonials(item)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to Testimonials
                        </Button>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
