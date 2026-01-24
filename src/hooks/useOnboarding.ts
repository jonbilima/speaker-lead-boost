import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerManualConfetti } from "./useConfetti";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: string;
  route: string;
  checkComplete: () => Promise<boolean>;
}

export interface OnboardingProgress {
  id: string;
  user_id: string;
  steps_completed: string[];
  current_step: number;
  tour_completed: boolean;
  completed_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "profile",
    title: "Complete your profile",
    description: "Add your name, bio, speaking topics, and fee range",
    action: "Set up profile",
    route: "/profile",
    checkComplete: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, bio, fee_range_min")
        .eq("id", session.user.id)
        .single();
      
      const { data: topics } = await supabase
        .from("user_topics")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);
      
      return !!(profile?.name && profile?.bio && topics && topics.length > 0);
    },
  },
  {
    id: "headshot",
    title: "Upload a headshot",
    description: "Add a professional photo for your speaker packages",
    action: "Upload headshot",
    route: "/assets",
    checkComplete: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      const { data: assets } = await supabase
        .from("speaker_assets")
        .select("id")
        .eq("speaker_id", session.user.id)
        .eq("asset_type", "headshot")
        .limit(1);
      
      return !!(assets && assets.length > 0);
    },
  },
  {
    id: "opportunities",
    title: "Explore opportunities",
    description: "Review speaking opportunities matched to your profile",
    action: "Find opportunities",
    route: "/find",
    checkComplete: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      const { data: scores } = await supabase
        .from("opportunity_scores")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);
      
      return !!(scores && scores.length > 0);
    },
  },
  {
    id: "pitch",
    title: "Generate your first pitch",
    description: "Use AI to craft a personalized pitch for an opportunity",
    action: "Create pitch",
    route: "/pipeline",
    checkComplete: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      const { data: activities } = await supabase
        .from("outreach_activities")
        .select("id")
        .eq("speaker_id", session.user.id)
        .limit(1);
      
      return !!(activities && activities.length > 0);
    },
  },
  {
    id: "coach",
    title: "Meet your AI Coach",
    description: "Get personalized advice on building your speaking career",
    action: "Chat with coach",
    route: "/coach",
    checkComplete: async () => {
      // Check if user has visited the coach page (we'll track this via localStorage)
      return localStorage.getItem("onboarding_coach_visited") === "true";
    },
  },
];

export function useOnboarding() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepsStatus, setStepsStatus] = useState<Record<string, boolean>>({});

  const loadProgress = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Get or create progress record
      let { data: progressData, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // Record doesn't exist, create it
        const { data: newProgress } = await supabase
          .from("onboarding_progress")
          .insert({ user_id: session.user.id })
          .select()
          .single();
        progressData = newProgress;
      }

      if (progressData) {
        setProgress({
          ...progressData,
          steps_completed: Array.isArray(progressData.steps_completed) 
            ? progressData.steps_completed 
            : [],
        } as OnboardingProgress);
      }

      // Check status of each step
      const statuses: Record<string, boolean> = {};
      for (const step of ONBOARDING_STEPS) {
        statuses[step.id] = await step.checkComplete();
      }
      setStepsStatus(statuses);
    } catch (error) {
      console.error("Error loading onboarding:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const markStepComplete = async (stepId: string) => {
    if (!progress) return;

    const newCompleted = [...progress.steps_completed];
    if (!newCompleted.includes(stepId)) {
      newCompleted.push(stepId);
    }

    const allComplete = newCompleted.length === ONBOARDING_STEPS.length;

    const { error } = await supabase
      .from("onboarding_progress")
      .update({
        steps_completed: newCompleted,
        completed_at: allComplete ? new Date().toISOString() : null,
      })
      .eq("id", progress.id);

    if (!error) {
      setProgress({
        ...progress,
        steps_completed: newCompleted,
        completed_at: allComplete ? new Date().toISOString() : null,
      });
      setStepsStatus((prev) => ({ ...prev, [stepId]: true }));

      if (allComplete) {
        triggerManualConfetti();
      }
    }
  };

  const markTourComplete = async () => {
    if (!progress) return;

    await supabase
      .from("onboarding_progress")
      .update({ tour_completed: true })
      .eq("id", progress.id);

    setProgress({ ...progress, tour_completed: true });
  };

  const dismissOnboarding = async () => {
    if (!progress) return;

    await supabase
      .from("onboarding_progress")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", progress.id);

    setProgress({ ...progress, dismissed_at: new Date().toISOString() });
  };

  const completedCount = Object.values(stepsStatus).filter(Boolean).length;
  const totalSteps = ONBOARDING_STEPS.length;
  const isComplete = progress?.completed_at !== null;
  const isDismissed = progress?.dismissed_at !== null;
  const shouldShow = !loading && progress && !isComplete && !isDismissed;

  return {
    progress,
    loading,
    stepsStatus,
    completedCount,
    totalSteps,
    isComplete,
    isDismissed,
    shouldShow,
    markStepComplete,
    markTourComplete,
    dismissOnboarding,
    refresh: loadProgress,
  };
}