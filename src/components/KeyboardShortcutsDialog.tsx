import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { keyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⌨️ Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {keyboardShortcuts.map((shortcut, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIdx) => (
                  <span key={keyIdx} className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className="px-2 py-1 font-mono text-xs"
                    >
                      {key}
                    </Badge>
                    {keyIdx < shortcut.keys.length - 1 && (
                      <span className="text-muted-foreground text-xs">then</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Press <Badge variant="outline" className="px-1.5 py-0.5 text-xs font-mono">Esc</Badge> to close
        </p>
      </DialogContent>
    </Dialog>
  );
}
