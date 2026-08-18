import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Target, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { rescoreMatches } from "@/lib/rescoreMatches";

const DISMISS_KEY = "nextmic:verticals-prompt-dismissed";

type PromptState = "none" | "confirm" | "narrow";

/**
 * Non-blocking banner shown when a user's audiences were inferred from their
 * topics rather than chosen by them. Dismissible; never gates the app.
 */
export const ConfirmVerticalsPrompt = () => {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<string[]>([]);
  const [state, setState] = useState<PromptState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: rows } = await supabase
        .from("user_verticals")
        .select("vertical_slug, is_inferred")
        .eq("user_id", session.user.id);

      if (cancelled) return;

      if (!rows || rows.length === 0) {
        setLabels([]);
        setState("none");
        return;
      }

      const inferred = rows.filter((r) => r.is_inferred);
      if (inferred.length === 0) return;

      const slugs = inferred.map((r) => r.vertical_slug);
      const { data: list } = await supabase
        .from("verticals")
        .select("slug, label")
        .in("slug", slugs)
        .order("sort_order");

      if (cancelled) return;
      setLabels((list ?? []).map((v) => v.label));
      setState(inferred.length > 3 ? "narrow" : "confirm");
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setState(null);
  };

  const confirm = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_verticals")
      .update({ is_inferred: false, confirmed_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .eq("is_inferred", true);

    setSaving(false);

    if (error) {
      console.error("Failed to confirm verticals:", error);
      toast.error("Couldn't save that. Please try again.");
      return;
    }

    toast.success("Audiences confirmed");
    dismiss();
    void rescoreMatches({ silent: true });
  };

  if (!state) return null;

  if (state === "none") {
    return (
      <Card className="mb-4 border-accent/40 bg-accent/5 p-4">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">
              You haven't told us which audiences you speak to yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Without audiences we can't match you to incoming leads — your opportunity feed will
              stay empty. It takes about 30 seconds to pick two or three.
            </p>
            <div className="pt-1">
              <Button size="sm" onClick={() => navigate("/profile")}>
                Pick your audiences
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    );
  }

  const narrowing = state === "narrow";

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 space-y-2">
          {narrowing ? (
            <>
              <p className="text-sm font-medium">
                We inferred {labels.length} audiences from your topics — that's probably too many.
              </p>
              <p className="text-sm text-muted-foreground">
                Broad topics like Leadership or Communication map to a lot of audiences. Narrowing
                to the two or three you actually speak to produces better matched leads.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium">
              We inferred the audiences you speak to from your topics. Does this look right?
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <Badge key={label} variant="secondary">{label}</Badge>
            ))}
          </div>
          {narrowing ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" onClick={() => navigate("/profile")}>
                Narrow my audiences
              </Button>
              <Button size="sm" variant="ghost" onClick={confirm} disabled={saving}>
                {saving ? "Saving..." : "Keep all " + labels.length}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={confirm} disabled={saving}>
                {saving ? "Saving..." : "Yes, that's right"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/profile")}>
                Adjust audiences
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
};
