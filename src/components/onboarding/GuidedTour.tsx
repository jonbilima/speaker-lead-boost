import { useState, useEffect, useCallback } from "react";
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from "react-joyride";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useLocation } from "react-router-dom";

// Helper to safely check if a DOM element exists for a tour step target
const isTargetAvailable = (target: string | HTMLElement): boolean => {
  if (typeof target !== "string") return true;
  if (target === "body") return true;
  
  try {
    const element = document.querySelector(target);
    return element !== null;
  } catch (e) {
    console.warn("Invalid selector for tour target:", target);
    return false;
  }
};

const DASHBOARD_STEPS: Step[] = [
  {
    target: "body",
    content: "Welcome to nextmic! Let me show you around. This quick tour will help you get started.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="stats"]',
    content: "Your dashboard shows key metrics: opportunities in pipeline, upcoming events, and revenue progress.",
    placement: "bottom",
  },
  {
    target: '[data-tour="quick-actions"]',
    content: "Quick actions help you take immediate steps - from generating pitches to building speaker packages.",
    placement: "bottom",
  },
  {
    target: '[data-tour="opportunities"]',
    content: "Your top-matched opportunities appear here, ranked by AI based on your profile and topics.",
    placement: "top",
  },
  {
    target: '[data-tour="sidebar"]',
    content: "Navigate between pages using the sidebar. Find opportunities, manage your pipeline, and track your business.",
    placement: "right",
  },
];

const FIND_PAGE_STEPS: Step[] = [
  {
    target: '[data-tour="search"]',
    content: "Search for opportunities by event name, topic, or organization.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="filters"]',
    content: "Filter by fee range, deadline, and more to find your perfect opportunities.",
    placement: "bottom",
  },
  {
    target: '[data-tour="smart-lists"]',
    content: "Smart lists automatically organize opportunities - see perfect matches, closing soon, and more.",
    placement: "right",
  },
];

const PIPELINE_PAGE_STEPS: Step[] = [
  {
    target: '[data-tour="pipeline-columns"]',
    content: "Your pipeline shows opportunities at each stage. Drag cards between columns as you progress.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="pipeline-new"]',
    content: "New opportunities start here. Review and move them to 'Interested' to start tracking.",
    placement: "right",
  },
  {
    target: '[data-tour="pipeline-pitched"]',
    content: "Once you've sent a pitch, move opportunities here to track responses.",
    placement: "left",
  },
];

export function GuidedTour() {
  const location = useLocation();
  const { progress, markTourComplete } = useOnboarding();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  // Filter steps to only include those with existing target elements
  const filterAvailableSteps = useCallback((stepsToFilter: Step[]): Step[] => {
    return stepsToFilter.filter((step) => isTargetAvailable(step.target as string));
  }, []);

  useEffect(() => {
    // Check if we should show tour
    const hasSeenTour = localStorage.getItem("tour_completed");
    
    if (progress && !progress.tour_completed && !hasSeenTour) {
      // Set steps based on current route with a delay to ensure DOM is ready
      const initTour = (stepsToUse: Step[], localStorageKey?: string) => {
        setTimeout(() => {
          const availableSteps = filterAvailableSteps(stepsToUse);
          if (availableSteps.length > 0) {
            setSteps(availableSteps);
            setStepIndex(0);
            setRun(true);
          }
        }, 1000);
      };

      if (location.pathname === "/dashboard") {
        initTour(DASHBOARD_STEPS);
      } else if (location.pathname === "/find") {
        const hasSeenFindTour = localStorage.getItem("tour_find_completed");
        if (!hasSeenFindTour) {
          initTour(FIND_PAGE_STEPS);
        }
      } else if (location.pathname === "/pipeline") {
        const hasSeenPipelineTour = localStorage.getItem("tour_pipeline_completed");
        if (!hasSeenPipelineTour) {
          initTour(PIPELINE_PAGE_STEPS);
        }
      }
    }
  }, [location.pathname, progress, filterAvailableSteps]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      
      // Mark tour as complete based on route
      if (location.pathname === "/dashboard") {
        localStorage.setItem("tour_completed", "true");
        markTourComplete();
      } else if (location.pathname === "/find") {
        localStorage.setItem("tour_find_completed", "true");
      } else if (location.pathname === "/pipeline") {
        localStorage.setItem("tour_pipeline_completed", "true");
      }
    }

    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + 1);
    }
  };

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton={false}
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      stepIndex={stepIndex}
      steps={steps}
      styles={{
        options: {
          arrowColor: "hsl(var(--card))",
          backgroundColor: "hsl(var(--card))",
          overlayColor: "rgba(0, 0, 0, 0.5)",
          primaryColor: "hsl(var(--accent))",
          textColor: "hsl(var(--foreground))",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "0.75rem",
          padding: "1.25rem",
        },
        tooltipTitle: {
          fontSize: "1rem",
          fontWeight: 600,
        },
        tooltipContent: {
          fontSize: "0.875rem",
          padding: "0.5rem 0",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--accent))",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "0.5rem",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Got it!",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}