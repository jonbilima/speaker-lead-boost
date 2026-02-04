import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PipelineOpportunity } from "@/components/pipeline/PipelineCard";
import { createFollowUpReminders, getUserFollowUpIntervals } from "@/hooks/useFollowUpReminders";
import { format } from "date-fns";

export interface PipelineTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export function usePipelineBulkActions(
  opportunities: PipelineOpportunity[],
  onRefresh: () => void
) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<PipelineTag[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, message: "" });

  // Load user's tags
  const loadTags = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("pipeline_tags")
      .select("*")
      .eq("user_id", session.user.id)
      .order("name");

    if (data) setTags(data);
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Toggle selection mode
  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Selection helpers
  const toggleSelection = useCallback((scoreId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scoreId)) {
        next.delete(scoreId);
      } else {
        next.add(scoreId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = opportunities.map((o) => o.score_id);
    setSelectedIds(new Set(allIds));
  }, [opportunities]);

  const selectAllInStage = useCallback((stage: string) => {
    const stageIds = opportunities
      .filter((o) => o.pipeline_stage === stage)
      .map((o) => o.score_id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      stageIds.forEach((id) => next.add(id));
      return next;
    });
  }, [opportunities]);

  const deselectAllInStage = useCallback((stage: string) => {
    const stageIds = new Set(
      opportunities.filter((o) => o.pipeline_stage === stage).map((o) => o.score_id)
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      stageIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [opportunities]);

  const isAllInStageSelected = useCallback(
    (stage: string) => {
      const stageOpps = opportunities.filter((o) => o.pipeline_stage === stage);
      if (stageOpps.length === 0) return false;
      return stageOpps.every((o) => selectedIds.has(o.score_id));
    },
    [opportunities, selectedIds]
  );

  // Bulk move to stage
  const bulkMoveToStage = useCallback(
    async (targetStage: string) => {
      if (selectedIds.size === 0) return;

      setIsProcessing(true);
      setProcessingProgress({ current: 0, total: selectedIds.size, message: "Moving opportunities..." });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsProcessing(false);
        return;
      }

      try {
        const ids = Array.from(selectedIds);
        const updateData: Record<string, any> = { pipeline_stage: targetStage };

        if (targetStage === "interested") updateData.interested_at = new Date().toISOString();
        if (targetStage === "accepted") updateData.accepted_at = new Date().toISOString();
        if (targetStage === "rejected") updateData.rejected_at = new Date().toISOString();
        if (targetStage === "completed") updateData.completed_at = new Date().toISOString();

        const { error } = await supabase
          .from("opportunity_scores")
          .update(updateData)
          .in("id", ids);

        if (error) throw error;

        // Create follow-up reminders if moving to "pitched"
        if (targetStage === "pitched") {
          const intervals = await getUserFollowUpIntervals(session.user.id);
          for (const id of ids) {
            await createFollowUpReminders(session.user.id, id, new Date(), intervals);
          }
        }

        toast.success(`${ids.length} opportunities moved`);
        exitSelectionMode();
        onRefresh();
      } catch (error) {
        console.error("Bulk move error:", error);
        toast.error("Failed to move opportunities");
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedIds, exitSelectionMode, onRefresh]
  );

  // Create a new tag
  const createTag = useCallback(
    async (name: string, color: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from("pipeline_tags")
        .insert({ user_id: session.user.id, name, color })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create tag");
        return null;
      }

      setTags((prev) => [...prev, data]);
      return data;
    },
    []
  );

  // Bulk add tag
  const bulkAddTag = useCallback(
    async (tagId: string) => {
      if (selectedIds.size === 0) return;

      setIsProcessing(true);
      const ids = Array.from(selectedIds);

      try {
        // Get current tags for each opportunity and add the new tag
        for (const id of ids) {
          const { data: current } = await supabase
            .from("opportunity_scores")
            .select("tags")
            .eq("id", id)
            .single();

          const currentTags = (current?.tags || []) as string[];
          if (!currentTags.includes(tagId)) {
            await supabase
              .from("opportunity_scores")
              .update({ tags: [...currentTags, tagId] })
              .eq("id", id);
          }
        }

        toast.success(`Tag added to ${ids.length} opportunities`);
        onRefresh();
      } catch (error) {
        console.error("Bulk tag error:", error);
        toast.error("Failed to add tag");
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedIds, onRefresh]
  );

  // Bulk remove tag
  const bulkRemoveTag = useCallback(
    async (tagId: string) => {
      if (selectedIds.size === 0) return;

      setIsProcessing(true);
      const ids = Array.from(selectedIds);

      try {
        for (const id of ids) {
          const { data: current } = await supabase
            .from("opportunity_scores")
            .select("tags")
            .eq("id", id)
            .single();

          const currentTags = (current?.tags || []) as string[];
          await supabase
            .from("opportunity_scores")
            .update({ tags: currentTags.filter((t) => t !== tagId) })
            .eq("id", id);
        }

        toast.success(`Tag removed from ${ids.length} opportunities`);
        onRefresh();
      } catch (error) {
        console.error("Bulk remove tag error:", error);
        toast.error("Failed to remove tag");
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedIds, onRefresh]
  );

  // Bulk export to CSV
  const bulkExport = useCallback(() => {
    const selected = opportunities.filter((o) => selectedIds.has(o.score_id));
    
    const headers = ["Event Name", "Organization", "Date", "Location", "Fee Range", "Status", "Score"];
    const rows = selected.map((o) => [
      o.event_name,
      o.organizer_name || "",
      o.event_date ? format(new Date(o.event_date), "yyyy-MM-dd") : "",
      o.location || "",
      o.fee_estimate_min && o.fee_estimate_max
        ? `$${o.fee_estimate_min}-$${o.fee_estimate_max}`
        : "",
      o.pipeline_stage,
      o.ai_score.toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nextmic-pipeline-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${selected.length} opportunities`);
  }, [opportunities, selectedIds]);

  // Bulk archive (soft delete)
  const bulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    const ids = Array.from(selectedIds);

    try {
      const { error } = await supabase
        .from("opportunity_scores")
        .update({ is_archived: true })
        .in("id", ids);

      if (error) throw error;

      toast.success(`${ids.length} opportunities archived`);
      exitSelectionMode();
      onRefresh();
    } catch (error) {
      console.error("Bulk archive error:", error);
      toast.error("Failed to archive opportunities");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, exitSelectionMode, onRefresh]);

  // Bulk generate pitches
  const bulkGeneratePitches = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const selected = opportunities.filter((o) => selectedIds.has(o.score_id));
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: selected.length, message: "Generating pitches..." });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsProcessing(false);
      return;
    }

    let successCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const opp = selected[i];
      setProcessingProgress({
        current: i + 1,
        total: selected.length,
        message: `Generating pitch ${i + 1} of ${selected.length}...`,
      });

      try {
        const response = await supabase.functions.invoke("generate-pitch", {
          body: {
            userId: session.user.id,
            opportunityId: opp.id,
            tone: "professional",
          },
        });

        if (response.data) {
          successCount++;
        }

        // Rate limiting - wait 1 second between requests
        if (i < selected.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate pitch for ${opp.event_name}:`, error);
      }
    }

    setIsProcessing(false);
    toast.success(`${successCount} pitches generated`);
  }, [opportunities, selectedIds]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectionMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitSelectionMode();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectionMode, exitSelectionMode, selectAll]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    tags,
    isProcessing,
    processingProgress,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    selectAllInStage,
    deselectAllInStage,
    isAllInStageSelected,
    bulkMoveToStage,
    createTag,
    bulkAddTag,
    bulkRemoveTag,
    bulkExport,
    bulkArchive,
    bulkGeneratePitches,
    loadTags,
  };
}
