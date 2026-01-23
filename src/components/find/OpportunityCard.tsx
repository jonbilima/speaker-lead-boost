import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, Calendar, DollarSign, Clock, Eye, Zap, 
  Bookmark, X, ExternalLink, Users 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Opportunity } from "@/pages/Find";

interface OpportunityCardProps {
  opportunity: Opportunity;
  viewMode: "card" | "list";
  onQuickApply: () => void;
  onRefresh: () => void;
}

export function OpportunityCard({ opportunity, viewMode, onQuickApply, onRefresh }: OpportunityCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  const getDeadlineInfo = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", urgent: false };
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: "Passed", urgent: true };
    if (days === 0) return { text: "Closes today", urgent: true };
    if (days === 1) return { text: "Closes tomorrow", urgent: true };
    if (days <= 7) return { text: `${days} days left`, urgent: true };
    return { text: `${days} days left`, urgent: false };
  };

  const formatFee = (min: number | null, max: number | null) => {
    if (!min && !max) return "Fee TBD";
    if (min && max) return `$${(min/1000).toFixed(0)}k - $${(max/1000).toFixed(0)}k`;
    if (max) return `Up to $${(max/1000).toFixed(0)}k`;
    return `From $${(min!/1000).toFixed(0)}k`;
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check if score exists
      const { data: existing } = await supabase
        .from("opportunity_scores")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("opportunity_id", opportunity.id)
        .single();

      if (existing) {
        await supabase
          .from("opportunity_scores")
          .update({ pipeline_stage: "interested", interested_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("opportunity_scores")
          .insert({
            user_id: session.user.id,
            opportunity_id: opportunity.id,
            pipeline_stage: "interested",
            interested_at: new Date().toISOString(),
          });
      }
      
      toast.success("Saved to pipeline");
      onRefresh();
    } catch (error) {
      toast.error("Failed to save");
    }
  };

  const handlePass = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: existing } = await supabase
        .from("opportunity_scores")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("opportunity_id", opportunity.id)
        .single();

      if (existing) {
        await supabase
          .from("opportunity_scores")
          .update({ pipeline_stage: "rejected", rejected_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("opportunity_scores")
          .insert({
            user_id: session.user.id,
            opportunity_id: opportunity.id,
            pipeline_stage: "rejected",
            rejected_at: new Date().toISOString(),
          });
      }
      
      toast.success("Opportunity passed");
      onRefresh();
    } catch (error) {
      toast.error("Failed to pass");
    }
  };

  const deadlineInfo = getDeadlineInfo(opportunity.deadline);

  if (viewMode === "list") {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge className={`${getScoreColor(opportunity.ai_score)} shrink-0`}>
              {opportunity.ai_score}%
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{opportunity.event_name}</h3>
                {opportunity.event_url && (
                  <a href={opportunity.event_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {opportunity.organizer_name && <span>{opportunity.organizer_name}</span>}
                {opportunity.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {opportunity.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max)}
                </span>
                <span className={`flex items-center gap-1 ${deadlineInfo.urgent ? "text-destructive" : ""}`}>
                  <Clock className="h-3 w-3" />
                  {deadlineInfo.text}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={onQuickApply}>
                <Zap className="h-4 w-4 mr-1" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <Badge className={getScoreColor(opportunity.ai_score)}>
            {opportunity.ai_score}% match
          </Badge>
          {deadlineInfo.urgent && (
            <Badge variant="destructive" className="shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {deadlineInfo.text}
            </Badge>
          )}
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground line-clamp-1">{opportunity.event_name}</h3>
            {opportunity.event_url && (
              <a href={opportunity.event_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary shrink-0" />
              </a>
            )}
          </div>
          {opportunity.organizer_name && (
            <p className="text-sm text-muted-foreground">{opportunity.organizer_name}</p>
          )}
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {opportunity.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {opportunity.location}
            </span>
          )}
          {opportunity.event_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(opportunity.event_date).toLocaleDateString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {formatFee(opportunity.fee_estimate_min, opportunity.fee_estimate_max)}
          </span>
          {opportunity.audience_size && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {opportunity.audience_size.toLocaleString()}
            </span>
          )}
        </div>

        {/* Deadline (non-urgent) */}
        {!deadlineInfo.urgent && opportunity.deadline && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {deadlineInfo.text}
          </p>
        )}

        {/* Topics */}
        {opportunity.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opportunity.topics.slice(0, 3).map((topic, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {opportunity.topics.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{opportunity.topics.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button className="flex-1" size="sm" onClick={onQuickApply}>
            <Zap className="h-4 w-4 mr-1" />
            Quick Apply
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePass}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}