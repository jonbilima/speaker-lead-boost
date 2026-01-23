import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  X, 
  ClipboardList, 
  Calendar, 
  Star, 
  PlusCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  action: () => void;
}

export function FloatingActionButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [topMatchesOpen, setTopMatchesOpen] = useState(false);
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const navigate = useNavigate();

  const [activityForm, setActivityForm] = useState({
    type: "note" as "email_sent" | "call" | "meeting" | "note" | "social_interaction" | "email_received" | "follow_up",
    notes: "",
  });

  const handleLogActivity = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("outreach_activities").insert({
      speaker_id: user.id,
      activity_type: activityForm.type,
      notes: activityForm.notes,
    });

    if (error) {
      toast.error("Failed to log activity");
    } else {
      toast.success("Activity logged!");
      setActivityDialogOpen(false);
      setActivityForm({ type: "note", notes: "" });
    }
  };

  const loadTopMatches = async () => {
    setLoadingMatches(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("opportunity_scores")
      .select(`
        ai_score,
        opportunities (
          id,
          event_name,
          organizer_name,
          deadline
        )
      `)
      .eq("user_id", user.id)
      .order("ai_score", { ascending: false })
      .limit(5);

    setTopMatches(data || []);
    setLoadingMatches(false);
  };

  const actions: QuickAction[] = [
    {
      id: "activity",
      label: "Log Activity",
      icon: ClipboardList,
      color: "bg-blue-500",
      action: () => {
        setIsExpanded(false);
        setActivityDialogOpen(true);
      },
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: Calendar,
      color: "bg-green-500",
      action: () => {
        setIsExpanded(false);
        navigate("/calendar");
      },
    },
    {
      id: "matches",
      label: "Top Matches",
      icon: Star,
      color: "bg-yellow-500",
      action: () => {
        setIsExpanded(false);
        loadTopMatches();
        setTopMatchesOpen(true);
      },
    },
    {
      id: "add",
      label: "New Lead",
      icon: PlusCircle,
      color: "bg-purple-500",
      action: () => {
        setIsExpanded(false);
        navigate("/leads");
      },
    },
  ];

  return (
    <>
      {/* Overlay */}
      {isExpanded && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="md:hidden fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3">
        {/* Action Buttons */}
        {isExpanded && actions.map((action, index) => (
          <div
            key={action.id}
            className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="bg-background px-3 py-1.5 rounded-full shadow-lg text-sm font-medium">
              {action.label}
            </span>
            <button
              onClick={action.action}
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center shadow-lg text-white",
                action.color
              )}
            >
              <action.icon className="h-5 w-5" />
            </button>
          </div>
        ))}

        {/* Main FAB */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
            isExpanded 
              ? "bg-muted-foreground rotate-45" 
              : "bg-violet-600 hover:bg-violet-700"
          )}
        >
          {isExpanded ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Log Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Log Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Activity Type</Label>
              <Select 
                value={activityForm.type} 
                onValueChange={(v) => setActivityForm(prev => ({ ...prev, type: v as typeof prev.type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="email_sent">Email Sent</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="social_interaction">LinkedIn Message</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                placeholder="What did you do?"
                value={activityForm.notes}
                onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <Button onClick={handleLogActivity} className="w-full bg-violet-600 hover:bg-violet-700">
              Log Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Matches Dialog */}
      <Dialog open={topMatchesOpen} onOpenChange={setTopMatchesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Top 5 Matches
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingMatches ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : topMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No matches yet
              </div>
            ) : (
              topMatches.map((match) => (
                <div 
                  key={match.opportunities.id}
                  className="p-3 rounded-lg border flex items-center gap-3"
                  onClick={() => {
                    setTopMatchesOpen(false);
                    navigate("/pipeline");
                  }}
                >
                  <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="font-bold text-violet-600">{match.ai_score}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{match.opportunities.event_name}</p>
                    {match.opportunities.organizer_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {match.opportunities.organizer_name}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
