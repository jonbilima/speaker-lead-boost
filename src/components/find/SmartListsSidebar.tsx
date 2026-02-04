import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Star, Sparkles, Plus, Lock } from "lucide-react";
import { Opportunity, FilterState } from "@/pages/Find";
import { SavedSearch, useSavedSearches } from "@/hooks/useSavedSearches";
import { SavedSearchCard } from "./SavedSearchCard";
import { SaveSearchDialog } from "./SaveSearchDialog";

interface SmartListsSidebarProps {
  activeList: string | null;
  onSelectList: (listId: string) => void;
  opportunities: Opportunity[];
  activeSavedSearchId: string | null;
  onSelectSavedSearch: (search: SavedSearch) => void;
  currentFilters: FilterState;
  hasActiveFilters: boolean;
}

export function SmartListsSidebar({ 
  activeList, 
  onSelectList, 
  opportunities,
  activeSavedSearchId,
  onSelectSavedSearch,
  currentFilters,
  hasActiveFilters,
}: SmartListsSidebarProps) {
  const {
    savedSearches,
    loading,
    saving,
    saveSearch,
    updateSearch,
    deleteSearch,
    duplicateSearch,
    canSaveMore,
    remainingSlots,
    limit,
  } = useSavedSearches();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);

  // Calculate counts for smart lists
  const closingSoonCount = opportunities.filter(opp => {
    if (!opp.deadline || opp.pipeline_stage) return false;
    const days = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 14;
  }).length;

  const perfectMatchesCount = opportunities.filter(opp => 
    opp.ai_score >= 85 && (!opp.pipeline_stage || opp.pipeline_stage === "new")
  ).length;

  const newThisWeekCount = opportunities.filter(opp => 
    !opp.pipeline_stage || opp.pipeline_stage === "new"
  ).length;

  const smartLists = [
    {
      id: "closing-soon",
      name: "Closing Soon",
      description: "Deadline within 14 days",
      icon: Clock,
      count: closingSoonCount,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      id: "perfect-matches",
      name: "Perfect Matches",
      description: "85%+ match score",
      icon: Star,
      count: perfectMatchesCount,
      color: "text-green-600 dark:text-green-400",
    },
    {
      id: "new-this-week",
      name: "New This Week",
      description: "Recently added",
      icon: Sparkles,
      count: newThisWeekCount,
      color: "text-primary",
    },
  ];

  const handleSaveSearch = async (name: string, icon: string, notify: boolean) => {
    return saveSearch(name, currentFilters, icon, notify);
  };

  const handleEditSearch = (search: SavedSearch) => {
    setEditingSearch(search);
  };

  const handleUpdateSearch = async (
    updates: Partial<Pick<SavedSearch, "name" | "icon" | "notify_new_matches" | "filters">>
  ) => {
    if (editingSearch) {
      await updateSearch(editingSearch.id, updates);
      setEditingSearch(null);
    }
  };

  const handleToggleNotify = async (search: SavedSearch) => {
    await updateSearch(search.id, { notify_new_matches: !search.notify_new_matches });
  };

  return (
    <>
      <Card className="sticky top-4" data-tour="smart-lists">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Smart Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {smartLists.map(list => (
            <Button
              key={list.id}
              variant={activeList === list.id ? "secondary" : "ghost"}
              className="w-full justify-start h-auto py-2"
              onClick={() => onSelectList(list.id)}
            >
              <list.icon className={`h-4 w-4 mr-2 ${list.color}`} />
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{list.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {list.count}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{list.description}</p>
              </div>
            </Button>
          ))}
          
          <Separator className="my-3" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">My Saved Searches</span>
            <span className="text-xs text-muted-foreground">
              {savedSearches.length}/{limit}
            </span>
          </div>

          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">No saved searches yet</p>
              <p className="text-xs text-muted-foreground">
                Apply filters and save them for quick access
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {savedSearches.map((search) => (
                <SavedSearchCard
                  key={search.id}
                  search={search}
                  isActive={activeSavedSearchId === search.id}
                  onSelect={() => onSelectSavedSearch(search)}
                  onEdit={() => handleEditSearch(search)}
                  onDuplicate={() => duplicateSearch(search)}
                  onDelete={() => deleteSearch(search.id)}
                  onToggleNotify={() => handleToggleNotify(search)}
                />
              ))}
            </div>
          )}

          <div className="pt-2">
            {canSaveMore ? (
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setSaveDialogOpen(true)}
                disabled={!hasActiveFilters}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  {hasActiveFilters ? "Save Current Search" : "Apply filters to save"}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                disabled
              >
                <Lock className="h-4 w-4 mr-2" />
                <span className="text-sm">Upgrade for more</span>
              </Button>
            )}
            {remainingSlots > 0 && remainingSlots < 3 && (
              <p className="text-xs text-muted-foreground px-2 mt-1">
                {remainingSlots} saved search{remainingSlots !== 1 ? "es" : ""} remaining
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <SaveSearchDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        filters={currentFilters}
        onSave={handleSaveSearch}
        saving={saving}
      />

      <SaveSearchDialog
        open={!!editingSearch}
        onOpenChange={(open) => !open && setEditingSearch(null)}
        filters={currentFilters}
        onSave={handleSaveSearch}
        saving={saving}
        existingSearch={editingSearch || undefined}
        onUpdate={handleUpdateSearch}
      />
    </>
  );
}
