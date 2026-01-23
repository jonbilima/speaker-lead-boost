import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Search, Filter, LayoutGrid, List, DollarSign, 
  Clock, Bookmark, X, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OpportunityCard } from "@/components/find/OpportunityCard";
import { SmartListsSidebar } from "@/components/find/SmartListsSidebar";
import { QuickApplyModal } from "@/components/find/QuickApplyModal";
import { FilterPanel } from "@/components/find/FilterPanel";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Opportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email: string | null;
  description: string | null;
  deadline: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  event_date: string | null;
  location: string | null;
  audience_size: number | null;
  event_url: string | null;
  ai_score: number;
  ai_reason: string | null;
  topics: string[];
  pipeline_stage?: string;
}

export interface FilterState {
  industries: string[];
  types: string[];
  feeRanges: string[];
  deadlines: string[];
  search: string;
}

const INDUSTRIES = ["Education", "Corporate", "Faith-Based", "Nonprofit", "Healthcare", "Government", "Small Business"];
const EVENT_TYPES = ["Conference", "Corporate Event", "Workshop", "Keynote", "Panel", "Virtual"];
const FEE_RANGES = ["$1-3k", "$3-5k", "$5-10k", "$10k+"];
const DEADLINE_RANGES = ["This Week", "This Month", "Next 3 Months"];

const Find = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    industries: [],
    types: [],
    feeRanges: [],
    deadlines: [],
    search: "",
  });
  const [sortBy, setSortBy] = useState<"match" | "deadline" | "fee" | "date">("match");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [quickApplyOpen, setQuickApplyOpen] = useState(false);
  const [activeSmartList, setActiveSmartList] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get opportunities with scores
      const { data: scores, error: scoresError } = await supabase
        .from("opportunity_scores")
        .select(`
          id,
          ai_score,
          ai_reason,
          pipeline_stage,
          opportunities (
            id,
            event_name,
            organizer_name,
            organizer_email,
            description,
            deadline,
            fee_estimate_min,
            fee_estimate_max,
            event_date,
            location,
            audience_size,
            event_url
          )
        `)
        .eq("user_id", session.user.id)
        .order("ai_score", { ascending: false });

      if (scoresError) throw scoresError;

      // Get all opportunities that user hasn't seen yet
      const { data: allOpps, error: oppsError } = await supabase
        .from("opportunities")
        .select("*")
        .eq("is_active", true);

      if (oppsError) throw oppsError;

      // Get topics for all opportunities
      const { data: oppTopics } = await supabase
        .from("opportunity_topics")
        .select(`
          opportunity_id,
          topics (name)
        `);

      const topicsMap: Record<string, string[]> = {};
      (oppTopics || []).forEach((ot: any) => {
        if (!topicsMap[ot.opportunity_id]) {
          topicsMap[ot.opportunity_id] = [];
        }
        if (ot.topics?.name) {
          topicsMap[ot.opportunity_id].push(ot.topics.name);
        }
      });

      // Combine scored and unscored opportunities
      const scoredIds = new Set((scores || []).map((s: any) => s.opportunities?.id).filter(Boolean));
      
      const scoredOpps: Opportunity[] = (scores || [])
        .filter((s: any) => s.opportunities)
        .map((s: any) => ({
          id: s.opportunities.id,
          event_name: s.opportunities.event_name,
          organizer_name: s.opportunities.organizer_name,
          organizer_email: s.opportunities.organizer_email,
          description: s.opportunities.description,
          deadline: s.opportunities.deadline,
          fee_estimate_min: s.opportunities.fee_estimate_min,
          fee_estimate_max: s.opportunities.fee_estimate_max,
          event_date: s.opportunities.event_date,
          location: s.opportunities.location,
          audience_size: s.opportunities.audience_size,
          event_url: s.opportunities.event_url,
          ai_score: s.ai_score || 0,
          ai_reason: s.ai_reason,
          topics: topicsMap[s.opportunities.id] || [],
          pipeline_stage: s.pipeline_stage,
        }));

      const unscoredOpps: Opportunity[] = (allOpps || [])
        .filter((o: any) => !scoredIds.has(o.id))
        .map((o: any) => ({
          id: o.id,
          event_name: o.event_name,
          organizer_name: o.organizer_name,
          organizer_email: o.organizer_email,
          description: o.description,
          deadline: o.deadline,
          fee_estimate_min: o.fee_estimate_min,
          fee_estimate_max: o.fee_estimate_max,
          event_date: o.event_date,
          location: o.location,
          audience_size: o.audience_size,
          event_url: o.event_url,
          ai_score: 50, // Default score for unscored
          ai_reason: null,
          topics: topicsMap[o.id] || [],
        }));

      setOpportunities([...scoredOpps, ...unscoredOpps]);
    } catch (error) {
      console.error("Error loading opportunities:", error);
      toast.error("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const toggleFilter = (category: keyof Omit<FilterState, "search">, value: string) => {
    setFilters(prev => {
      const current = prev[category] as string[];
      return {
        ...prev,
        [category]: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
  };

  const clearFilters = () => {
    setFilters({
      industries: [],
      types: [],
      feeRanges: [],
      deadlines: [],
      search: "",
    });
    setSearchTerm("");
    setActiveSmartList(null);
  };

  const applySmartList = (listId: string) => {
    clearFilters();
    setActiveSmartList(listId);
    
    // Smart list presets
    if (listId === "closing-soon") {
      setFilters(prev => ({ ...prev, deadlines: ["This Week", "This Month"] }));
    } else if (listId === "perfect-matches") {
      // This is filtered in the results
    } else if (listId === "new-this-week") {
      // This is filtered in the results
    }
  };

  // Filter and sort opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        opp.event_name.toLowerCase().includes(search) ||
        opp.organizer_name?.toLowerCase().includes(search) ||
        opp.topics.some(t => t.toLowerCase().includes(search)) ||
        opp.location?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Smart list filters
    if (activeSmartList === "perfect-matches" && opp.ai_score < 85) return false;
    if (activeSmartList === "closing-soon") {
      if (!opp.deadline) return false;
      const daysLeft = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 14 || daysLeft < 0) return false;
    }
    if (activeSmartList === "new-this-week") {
      // Assume opportunities from last 7 days (would need created_at field in reality)
    }

    // Fee range filter
    if (filters.feeRanges.length > 0) {
      const maxFee = opp.fee_estimate_max || 0;
      const matchesFee = filters.feeRanges.some(range => {
        if (range === "$1-3k") return maxFee >= 1000 && maxFee <= 3000;
        if (range === "$3-5k") return maxFee > 3000 && maxFee <= 5000;
        if (range === "$5-10k") return maxFee > 5000 && maxFee <= 10000;
        if (range === "$10k+") return maxFee > 10000;
        return false;
      });
      if (!matchesFee) return false;
    }

    // Deadline filter
    if (filters.deadlines.length > 0 && opp.deadline) {
      const daysLeft = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const matchesDeadline = filters.deadlines.some(range => {
        if (range === "This Week") return daysLeft >= 0 && daysLeft <= 7;
        if (range === "This Month") return daysLeft >= 0 && daysLeft <= 30;
        if (range === "Next 3 Months") return daysLeft >= 0 && daysLeft <= 90;
        return false;
      });
      if (!matchesDeadline) return false;
    }

    // Exclude already in pipeline (except new)
    if (opp.pipeline_stage && opp.pipeline_stage !== "new") return false;

    return true;
  });

  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    switch (sortBy) {
      case "match":
        return b.ai_score - a.ai_score;
      case "deadline":
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case "fee":
        return (b.fee_estimate_max || 0) - (a.fee_estimate_max || 0);
      case "date":
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      default:
        return 0;
    }
  });

  const handleQuickApply = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setQuickApplyOpen(true);
  };

  const activeFilterCount = 
    filters.industries.length + 
    filters.types.length + 
    filters.feeRanges.length + 
    filters.deadlines.length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Find Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover speaking opportunities matched to your expertise
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by event name, topic, or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="h-12 gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="ml-1">{activeFilterCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <FilterPanel
                filters={filters}
                onToggleFilter={toggleFilter}
                onClear={clearFilters}
                industries={INDUSTRIES}
                eventTypes={EVENT_TYPES}
                feeRanges={FEE_RANGES}
                deadlineRanges={DEADLINE_RANGES}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Quick Filter Chips */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {FEE_RANGES.map(range => (
              <Button
                key={range}
                variant={filters.feeRanges.includes(range) ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => toggleFilter("feeRanges", range)}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                {range}
              </Button>
            ))}
            {DEADLINE_RANGES.map(range => (
              <Button
                key={range}
                variant={filters.deadlines.includes(range) ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => toggleFilter("deadlines", range)}
              >
                <Clock className="h-3 w-3 mr-1" />
                {range}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{sortedOpportunities.length}</span> opportunities match your criteria
          </p>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Best Match</SelectItem>
                <SelectItem value="deadline">Deadline (soonest)</SelectItem>
                <SelectItem value="fee">Fee (highest)</SelectItem>
                <SelectItem value="date">Date (soonest)</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden sm:flex border rounded-md">
              <Button
                variant={viewMode === "card" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode("card")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Smart Lists Sidebar (Desktop) */}
          {!isMobile && (
            <div className="w-64 shrink-0">
              <SmartListsSidebar
                activeList={activeSmartList}
                onSelectList={applySmartList}
                opportunities={opportunities}
              />
            </div>
          )}

          {/* Results */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sortedOpportunities.length === 0 ? (
              <Card className="p-12 text-center">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="font-medium mb-2">No opportunities found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your filters or search term
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className={viewMode === "card" 
                ? "grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" 
                : "space-y-3"
              }>
                {sortedOpportunities.map(opp => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    viewMode={viewMode}
                    onQuickApply={() => handleQuickApply(opp)}
                    onRefresh={loadOpportunities}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Smart Lists Sheet */}
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                className="fixed bottom-20 left-4 z-40 shadow-lg"
              >
                <Bookmark className="h-4 w-4 mr-2" />
                Smart Lists
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh]">
              <SheetHeader>
                <SheetTitle>Smart Lists</SheetTitle>
              </SheetHeader>
              <SmartListsSidebar
                activeList={activeSmartList}
                onSelectList={(id) => {
                  applySmartList(id);
                }}
                opportunities={opportunities}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Quick Apply Modal */}
      <QuickApplyModal
        open={quickApplyOpen}
        onOpenChange={setQuickApplyOpen}
        opportunity={selectedOpportunity}
        onSuccess={() => {
          loadOpportunities();
          setQuickApplyOpen(false);
        }}
      />
    </AppLayout>
  );
};

export default Find;