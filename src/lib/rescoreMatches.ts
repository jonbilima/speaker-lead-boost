import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Recalculates opportunity match scores for the currently authenticated user.
 * Awaited (not fire-and-forget) — the scoring pass runs in well under a second.
 * Returns the number of scored rows, or null if it failed.
 */
export async function rescoreMatches(options?: { silent?: boolean }): Promise<number | null> {
  const { data, error } = await supabase.functions.invoke('rescore-opportunities');

  if (error) {
    console.error('Rescore error:', error);
    if (!options?.silent) {
      toast.error("Couldn't update your matches. Please try again.");
    }
    return null;
  }

  const count = typeof data?.scored_count === 'number' ? data.scored_count : 0;

  if (!options?.silent) {
    toast.success(`Matches updated — ${count} opportunities rescored`);
  }

  return count;
}
