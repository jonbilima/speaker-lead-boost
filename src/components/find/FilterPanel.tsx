import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { FilterState } from "@/pages/Find";

interface FilterPanelProps {
  filters: FilterState;
  onToggleFilter: (category: keyof Omit<FilterState, "search">, value: string) => void;
  onClear: () => void;
  industries: string[];
  eventTypes: string[];
  feeRanges: string[];
  deadlineRanges: string[];
}

export function FilterPanel({ 
  filters, 
  onToggleFilter, 
  onClear, 
  industries, 
  eventTypes, 
  feeRanges, 
  deadlineRanges 
}: FilterPanelProps) {
  const activeCount = 
    filters.industries.length + 
    filters.types.length + 
    filters.feeRanges.length + 
    filters.deadlines.length;

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-6 py-4">
        {/* Clear All */}
        {activeCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{activeCount} filters active</span>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        )}

        {/* Industry */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Industry</h4>
          <div className="flex flex-wrap gap-2">
            {industries.map(industry => (
              <Badge
                key={industry}
                variant={filters.industries.includes(industry) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onToggleFilter("industries", industry)}
              >
                {industry}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Event Type */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Event Type</h4>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(type => (
              <Badge
                key={type}
                variant={filters.types.includes(type) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onToggleFilter("types", type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Fee Range */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Fee Range</h4>
          <div className="flex flex-wrap gap-2">
            {feeRanges.map(range => (
              <Badge
                key={range}
                variant={filters.feeRanges.includes(range) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onToggleFilter("feeRanges", range)}
              >
                {range}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Deadline */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Deadline</h4>
          <div className="flex flex-wrap gap-2">
            {deadlineRanges.map(range => (
              <Badge
                key={range}
                variant={filters.deadlines.includes(range) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onToggleFilter("deadlines", range)}
              >
                {range}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}