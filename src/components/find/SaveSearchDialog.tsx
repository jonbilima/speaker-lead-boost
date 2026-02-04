import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FilterState } from "@/pages/Find";
import { SavedSearch } from "@/hooks/useSavedSearches";
import { Loader2, Bell, Sparkles } from "lucide-react";

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onSave: (name: string, icon: string, notify: boolean) => Promise<SavedSearch | null>;
  saving: boolean;
  existingSearch?: SavedSearch;
  onUpdate?: (updates: Partial<Pick<SavedSearch, "name" | "icon" | "notify_new_matches" | "filters">>) => Promise<void>;
  onUpdateFilters?: () => void;
}

const ICON_OPTIONS = [
  "🔍", "⭐", "🎯", "💼", "🎤", "🏢", "📅", "💰", 
  "🚀", "🌟", "📍", "🎓", "💡", "🔥", "📊", "🏆"
];

export function SaveSearchDialog({
  open,
  onOpenChange,
  filters,
  onSave,
  saving,
  existingSearch,
  onUpdate,
  onUpdateFilters,
}: SaveSearchDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🔍");
  const [notify, setNotify] = useState(false);

  const isEditing = !!existingSearch;

  // Generate auto-suggestion based on filters
  const generateSuggestion = () => {
    const parts: string[] = [];
    
    if (filters.feeRanges.length > 0) {
      parts.push(filters.feeRanges.join(", "));
    }
    if (filters.deadlines.length > 0) {
      parts.push(filters.deadlines[0]);
    }
    if (filters.industries.length > 0) {
      parts.push(filters.industries.slice(0, 2).join(" & "));
    }
    if (filters.types.length > 0) {
      parts.push(filters.types[0]);
    }
    if (filters.search) {
      parts.push(`"${filters.search}"`);
    }

    return parts.length > 0 ? parts.join(" - ") : "My Search";
  };

  useEffect(() => {
    if (open) {
      if (existingSearch) {
        setName(existingSearch.name);
        setIcon(existingSearch.icon);
        setNotify(existingSearch.notify_new_matches);
      } else {
        setName(generateSuggestion());
        setIcon("🔍");
        setNotify(false);
      }
    }
  }, [open, existingSearch, filters]);

  const handleSave = async () => {
    if (!name.trim()) return;

    if (isEditing && onUpdate) {
      await onUpdate({ name, icon, notify_new_matches: notify });
      onOpenChange(false);
    } else {
      const result = await onSave(name, icon, notify);
      if (result) {
        onOpenChange(false);
      }
    }
  };

  const handleUpdateFilters = () => {
    if (onUpdate) {
      onUpdate({ filters });
      onUpdateFilters?.();
    }
  };

  const hasActiveFilters = 
    filters.industries.length > 0 ||
    filters.types.length > 0 ||
    filters.feeRanges.length > 0 ||
    filters.deadlines.length > 0 ||
    filters.search.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Saved Search" : "Save This Search"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update your saved search settings"
              : "Save your current filters to quickly access them later"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name your search</Label>
            <Input
              id="name"
              placeholder="e.g., Tech Conferences $5k+"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label>Choose an icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 text-xl rounded-md border transition-all ${
                    icon === emoji
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when new opportunities match
                </p>
              </div>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>

          {isEditing && hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleUpdateFilters}
            >
              Update with Current Filters
            </Button>
          )}

          {!isEditing && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-2">Current filters:</p>
              <div className="flex flex-wrap gap-1">
                {filters.feeRanges.map((f) => (
                  <span key={f} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
                {filters.deadlines.map((d) => (
                  <span key={d} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">
                    {d}
                  </span>
                ))}
                {filters.industries.map((i) => (
                  <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                    {i}
                  </span>
                ))}
                {filters.types.map((t) => (
                  <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    {t}
                  </span>
                ))}
                {filters.search && (
                  <span className="text-xs bg-muted-foreground/20 px-2 py-0.5 rounded">
                    "{filters.search}"
                  </span>
                )}
                {!hasActiveFilters && (
                  <span className="text-xs text-muted-foreground">No filters applied</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Save Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
