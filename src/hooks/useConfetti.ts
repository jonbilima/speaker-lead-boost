import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];

export function useConfetti(progressPercent: number, userId: string | null) {
  const celebratedMilestones = useRef<Set<number>>(new Set());
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!userId) return;

    // Load celebrated milestones from localStorage
    const storageKey = `revenue_milestones_${userId}_${new Date().getFullYear()}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      celebratedMilestones.current = new Set(JSON.parse(stored));
    }
    isInitialized.current = true;
  }, [userId]);

  useEffect(() => {
    if (!userId || !isInitialized.current) return;

    const storageKey = `revenue_milestones_${userId}_${new Date().getFullYear()}`;

    // Check if we've hit a new milestone
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (
        progressPercent >= threshold &&
        !celebratedMilestones.current.has(threshold)
      ) {
        // Celebrate!
        celebratedMilestones.current.add(threshold);
        localStorage.setItem(
          storageKey,
          JSON.stringify([...celebratedMilestones.current])
        );

        // Fire confetti
        fireConfetti(threshold);
      }
    }
  }, [progressPercent, userId]);
}

function fireConfetti(milestone: number) {
  const duration = milestone === 100 ? 5000 : 3000;
  const intensity = milestone / 25; // 1, 2, 3, or 4

  // Initial burst
  confetti({
    particleCount: 50 * intensity,
    spread: 60 + milestone / 2,
    origin: { y: 0.6 },
    colors: ["#8B5CF6", "#A855F7", "#D946EF", "#F97316", "#10B981"],
  });

  // Side bursts for bigger milestones
  if (milestone >= 50) {
    setTimeout(() => {
      confetti({
        particleCount: 30 * intensity,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#8B5CF6", "#A855F7", "#D946EF"],
      });
      confetti({
        particleCount: 30 * intensity,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#8B5CF6", "#A855F7", "#D946EF"],
      });
    }, 250);
  }

  // Extra celebration for 100%
  if (milestone === 100) {
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors: ["#FFD700", "#FFA500", "#FF6347"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    setTimeout(frame, 500);
  }
}

export function triggerManualConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#8B5CF6", "#A855F7", "#D946EF", "#F97316", "#10B981"],
  });
}
