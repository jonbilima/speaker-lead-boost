import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

interface KeyboardShortcutsOptions {
  onOpenToolkit?: () => void;
  onOpenSearch?: () => void;
  onOpenNew?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        setPendingG(false);
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Show help with ?
      if (e.key === "?" && !isMod) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Escape to close help or cancel pending G
      if (e.key === "Escape") {
        setShowHelp(false);
        setPendingG(false);
        return;
      }

      // Cmd/Ctrl + K: Global search
      if (isMod && e.key === "k") {
        e.preventDefault();
        options.onOpenSearch?.();
        return;
      }

      // Cmd/Ctrl + N: New
      if (isMod && e.key === "n") {
        e.preventDefault();
        options.onOpenNew?.();
        return;
      }

      // Cmd/Ctrl + /: Open Toolkit
      if (isMod && e.key === "/") {
        e.preventDefault();
        options.onOpenToolkit?.();
        return;
      }

      // G navigation sequences
      if (e.key === "g" && !isMod) {
        if (!pendingG) {
          setPendingG(true);
          // Reset after 1 second
          setTimeout(() => setPendingG(false), 1000);
          return;
        }
      }

      if (pendingG) {
        e.preventDefault();
        setPendingG(false);

        switch (e.key.toLowerCase()) {
          case "h":
            navigate("/dashboard");
            break;
          case "f":
            navigate("/find");
            break;
          case "p":
            navigate("/pipeline");
            break;
          case "b":
            navigate("/business");
            break;
          case "c":
            navigate("/calendar");
            break;
        }
      }
    },
    [navigate, options, pendingG]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, pendingG };
}

export const keyboardShortcuts = [
  { keys: ["⌘", "K"], description: "Global search" },
  { keys: ["⌘", "N"], description: "Create new (context-aware)" },
  { keys: ["⌘", "/"], description: "Open Toolkit drawer" },
  { keys: ["G", "H"], description: "Go to Home" },
  { keys: ["G", "F"], description: "Go to Find" },
  { keys: ["G", "P"], description: "Go to Pipeline" },
  { keys: ["G", "B"], description: "Go to Business" },
  { keys: ["G", "C"], description: "Go to Calendar" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];
