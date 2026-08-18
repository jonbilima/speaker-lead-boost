import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VerticalOption } from "@/components/profile/VerticalSelector";

/**
 * Loads the canonical vertical list plus the current user's selections, and
 * persists changes to public.user_verticals (additive diff — never a blind wipe).
 */
export function useVerticals(userId: string | null) {
  const [verticals, setVerticals] = useState<VerticalOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const savedSelection = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: list } = await supabase
        .from("verticals")
        .select("slug, label")
        .order("sort_order");

      let mine: string[] = [];
      if (userId) {
        const { data: rows } = await supabase
          .from("user_verticals")
          .select("vertical_slug")
          .eq("user_id", userId);
        mine = (rows ?? []).map((r) => r.vertical_slug);
      }

      if (cancelled) return;
      setVerticals(list ?? []);
      setSelected(mine);
      savedSelection.current = mine;
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback((slug: string) => {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, []);

  const hasChanged = useCallback(() => {
    return [...selected].sort().join(",") !== [...savedSelection.current].sort().join(",");
  }, [selected]);

  /** Persists the diff. Returns true on success. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const previous = savedSelection.current;
    const toAdd = selected.filter((s) => !previous.includes(s));
    const toRemove = previous.filter((s) => !selected.includes(s));

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("user_verticals")
        .delete()
        .eq("user_id", userId)
        .in("vertical_slug", toRemove);
      if (error) {
        console.error("Failed to remove verticals:", error);
        return false;
      }
    }

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from("user_verticals")
        .insert(
          toAdd.map((vertical_slug) => ({
            user_id: userId,
            vertical_slug,
            is_inferred: false,
            confirmed_at: new Date().toISOString(),
          })),
        );
      if (error) {
        console.error("Failed to add verticals:", error);
        return false;
      }
    }

    // Anything the user explicitly kept is now a stated preference, not a guess.
    const { error: confirmError } = await supabase
      .from("user_verticals")
      .update({ is_inferred: false, confirmed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_inferred", true);
    if (confirmError) {
      console.error("Failed to confirm verticals:", confirmError);
    }

    savedSelection.current = [...selected];
    return true;
  }, [selected, userId]);

  return { verticals, selected, setSelected, toggle, save, hasChanged, loading };
}
