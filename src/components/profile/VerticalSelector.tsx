import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export interface VerticalOption {
  slug: string;
  label: string;
}

interface VerticalSelectorProps {
  verticals: VerticalOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  disabled?: boolean;
}

/**
 * Multi-select audience/vertical picker. Minimum of one is required by the
 * callers; two or three is recommended because a single vertical produces a
 * noticeably thinner opportunity feed.
 */
export const VerticalSelector = ({ verticals, selected, onToggle, disabled }: VerticalSelectorProps) => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Which audiences do you speak to? *
        </Label>
        <p className="text-sm text-muted-foreground">
          Select at least one. We recommend picking two or three — speakers who choose a single
          audience see a much thinner opportunity feed.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {verticals.map((v) => {
          const isSelected = selected.includes(v.slug);
          return (
            <button
              key={v.slug}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onToggle(v.slug)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                "hover:border-primary/60 hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <span>{v.label}</span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Badge variant={selected.length === 0 ? "destructive" : "secondary"}>
          {selected.length} selected
        </Badge>
        {selected.length === 0 && (
          <span className="text-destructive">Pick at least one audience to continue.</span>
        )}
        {selected.length === 1 && (
          <span className="text-muted-foreground">
            Add one or two more for a fuller feed.
          </span>
        )}
      </div>
    </div>
  );
};
