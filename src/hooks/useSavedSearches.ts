import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FilterState } from "@/pages/Find";

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: FilterState;
  icon: string;
  color: string | null;
  notify_new_matches: boolean;
  last_viewed_at: string;
  results_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const FREE_TIER_LIMIT = 3;

export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSavedSearches = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", session.user.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // Parse the filters from JSONB to FilterState
      const parsedSearches = (data || []).map((search: any) => ({
        ...search,
        filters: search.filters as FilterState,
      }));

      setSavedSearches(parsedSearches);
    } catch (error) {
      console.error("Error loading saved searches:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const saveSearch = async (
    name: string,
    filters: FilterState,
    icon: string = "🔍",
    notifyNewMatches: boolean = false,
    color?: string
  ) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Check limit for free tier
      if (savedSearches.length >= FREE_TIER_LIMIT) {
        toast.error(`Free tier limited to ${FREE_TIER_LIMIT} saved searches. Upgrade to Pro for unlimited.`);
        return null;
      }

      const { data, error } = await supabase
        .from("saved_searches")
        .insert({
          user_id: session.user.id,
          name,
          filters: filters as any,
          icon,
          color: color || null,
          notify_new_matches: notifyNewMatches,
          sort_order: savedSearches.length,
        })
        .select()
        .single();

      if (error) throw error;

      const newSearch: SavedSearch = {
        ...data,
        filters: (data.filters as unknown) as FilterState,
      };

      setSavedSearches(prev => [...prev, newSearch]);
      toast.success("Search saved successfully!");
      return newSearch;
    } catch (error) {
      console.error("Error saving search:", error);
      toast.error("Failed to save search");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateSearch = async (
    id: string,
    updates: Partial<Pick<SavedSearch, "name" | "icon" | "color" | "notify_new_matches" | "filters">>
  ) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({
          ...updates,
          filters: updates.filters as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setSavedSearches(prev =>
        prev.map(s => (s.id === id ? { ...s, ...updates } : s))
      );
      toast.success("Search updated!");
    } catch (error) {
      console.error("Error updating search:", error);
      toast.error("Failed to update search");
    }
  };

  const deleteSearch = async (id: string) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSavedSearches(prev => prev.filter(s => s.id !== id));
      toast.success("Search deleted");
    } catch (error) {
      console.error("Error deleting search:", error);
      toast.error("Failed to delete search");
    }
  };

  const duplicateSearch = async (search: SavedSearch) => {
    return saveSearch(
      `${search.name} (copy)`,
      search.filters,
      search.icon,
      false,
      search.color || undefined
    );
  };

  const updateViewedAt = async (id: string) => {
    try {
      await supabase
        .from("saved_searches")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("id", id);
    } catch (error) {
      console.error("Error updating last viewed:", error);
    }
  };

  const updateResultsCount = async (id: string, count: number) => {
    try {
      await supabase
        .from("saved_searches")
        .update({ results_count: count })
        .eq("id", id);

      setSavedSearches(prev =>
        prev.map(s => (s.id === id ? { ...s, results_count: count } : s))
      );
    } catch (error) {
      console.error("Error updating results count:", error);
    }
  };

  const reorderSearches = async (newOrder: SavedSearch[]) => {
    setSavedSearches(newOrder);

    try {
      const updates = newOrder.map((search, index) => ({
        id: search.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("saved_searches")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }
    } catch (error) {
      console.error("Error reordering searches:", error);
      loadSavedSearches();
    }
  };

  const canSaveMore = savedSearches.length < FREE_TIER_LIMIT;
  const remainingSlots = FREE_TIER_LIMIT - savedSearches.length;

  return {
    savedSearches,
    loading,
    saving,
    saveSearch,
    updateSearch,
    deleteSearch,
    duplicateSearch,
    updateViewedAt,
    updateResultsCount,
    reorderSearches,
    reload: loadSavedSearches,
    canSaveMore,
    remainingSlots,
    limit: FREE_TIER_LIMIT,
  };
}
