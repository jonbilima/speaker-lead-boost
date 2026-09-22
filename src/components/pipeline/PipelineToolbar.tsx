import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface PipelineFilters {
  search: string;
  stage: string;
  vertical: string;
  contactPath: string;
  location: string;
  deadline: string;
  sort: string;
}

export const DEFAULT_PIPELINE_FILTERS: PipelineFilters = {
  search: "",
  stage: "all",
  vertical: "all",
  contactPath: "all",
  location: "all",
  deadline: "all",
  sort: "score",
};

interface PipelineToolbarProps {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  stages: { id: string; label: string }[];
  verticals: string[];
  locations: string[];
  resultCount: number;
}

export function PipelineToolbar({
  filters,
  onChange,
  stages,
  verticals,
  locations,
  resultCount,
}: PipelineToolbarProps) {
  const set = <K extends keyof PipelineFilters>(key: K, value: PipelineFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const isFiltered =
    filters.search !== "" ||
    filters.stage !== "all" ||
    filters.vertical !== "all" ||
    filters.contactPath !== "all" ||
    filters.location !== "all" ||
    filters.deadline !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search event or organization"
            className="pl-9"
          />
        </div>

        <Select value={filters.sort} onValueChange={(v) => set("sort", v)}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Match score</SelectItem>
            <SelectItem value="deadline">Deadline (soonest)</SelectItem>
            <SelectItem value="added">Date added (newest)</SelectItem>
            <SelectItem value="event_date">Event date (soonest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.stage} onValueChange={(v) => set("stage", v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.vertical} onValueChange={(v) => set("vertical", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Vertical" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verticals</SelectItem>
            {verticals.map((v) => (
              <SelectItem key={v} value={v}>
                {v.replace(/[-_]/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.contactPath} onValueChange={(v) => set("contactPath", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any contact status</SelectItem>
            <SelectItem value="has">Has a way to reach them</SelectItem>
            <SelectItem value="email">Has an email</SelectItem>
            <SelectItem value="none">No contact path</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.location} onValueChange={(v) => set("location", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.deadline} onValueChange={(v) => set("deadline", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Deadline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any deadline</SelectItem>
            <SelectItem value="7">Due within 7 days</SelectItem>
            <SelectItem value="30">Due within 30 days</SelectItem>
            <SelectItem value="none">No deadline listed</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...DEFAULT_PIPELINE_FILTERS, sort: filters.sort })}
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {resultCount} shown
        </span>
      </div>
    </div>
  );
}
