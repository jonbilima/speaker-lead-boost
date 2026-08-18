import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { rescoreMatches } from "@/lib/rescoreMatches";

const DISMISS_KEY = "nextmic:verticals-prompt-dismissed";

/**
 * Non-blocking banner shown when a user's audiences were inferred from their
 * topics rather than chosen by them. Dismissible; never gates the app.
 */
export const ConfirmVerticalsPrompt = () => {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: rows } = await supabase
        .from("user_verticals")
        .select("vertical_slug")
        .eq("user_id", session.user.id)
        .eq("is_inferred", true);

      if (!rows || rows.length === 0 || cancelled) return;

      const slugs = rows.map((r) => r.vertical_slug);
      const { data: list } = await supabase
        .from("verticals")
        .select("slug, label")
        .in("slug", slugs)
        .order("sort_order");

      if (cancelled) return;
      setLabels((list ?? []).map((v) => v.label));
      setVisible(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
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

  if (!visible) return null;

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">
            We guessed the audiences you speak to from your topics. Does this look right?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <Badge key={label} variant="secondary">{label}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={confirm} disabled={saving}>
              {saving ? "Saving..." : "Yes, that's right"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/profile")}>
              Adjust audiences
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
};
