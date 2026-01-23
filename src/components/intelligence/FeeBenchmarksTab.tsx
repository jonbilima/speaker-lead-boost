import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FeeBenchmark {
  id: string;
  experience_level: string;
  topic_category: string | null;
  event_type: string;
  fee_p25: number | null;
  fee_median: number | null;
  fee_p75: number | null;
  fee_p90: number | null;
  data_points: number;
}

const EXPERIENCE_LEVELS = [
  { value: "emerging", label: "Emerging Speaker" },
  { value: "established", label: "Established Speaker" },
  { value: "professional", label: "Professional Speaker" },
  { value: "celebrity", label: "Celebrity Speaker" },
];

const TOPIC_CATEGORIES = [
  { value: "Leadership", label: "Leadership" },
  { value: "Technology", label: "Technology" },
  { value: "Sales", label: "Sales" },
  { value: "Marketing", label: "Marketing" },
];

const EVENT_TYPES = [
  { value: "conference", label: "Conference" },
  { value: "corporate_keynote", label: "Corporate Keynote" },
];

export function FeeBenchmarksTab() {
  const [benchmarks, setBenchmarks] = useState<FeeBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [experienceLevel, setExperienceLevel] = useState("established");
  const [topicCategory, setTopicCategory] = useState("Leadership");
  const [eventType, setEventType] = useState("conference");

  useEffect(() => {
    const loadBenchmarks = async () => {
      const { data, error } = await supabase
        .from("fee_benchmarks")
        .select("*");

      if (error) {
        console.error("Error loading benchmarks:", error);
      } else {
        setBenchmarks(data || []);
      }
      setLoading(false);
    };

    loadBenchmarks();
  }, []);

  const matchingBenchmark = benchmarks.find(
    (b) =>
      b.experience_level === experienceLevel &&
      b.topic_category === topicCategory &&
      b.event_type === eventType
  );

  const formatFee = (fee: number | null) => {
    if (!fee) return "$0";
    return `$${fee.toLocaleString()}`;
  };

  const getBarWidth = (fee: number | null, maxFee: number) => {
    if (!fee || !maxFee) return 0;
    return (fee / maxFee) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Experience Level</Label>
          <Select value={experienceLevel} onValueChange={setExperienceLevel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Topic Category</Label>
          <Select value={topicCategory} onValueChange={setTopicCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPIC_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Event Type</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {matchingBenchmark ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-lg">Fee Benchmarks</h3>
            <span className="text-sm text-muted-foreground ml-auto">
              Based on {matchingBenchmark.data_points} data points
            </span>
          </div>

          <div className="space-y-4">
            {[
              { label: "25th Percentile", value: matchingBenchmark.fee_p25, color: "bg-blue-400" },
              { label: "Median (50th)", value: matchingBenchmark.fee_median, color: "bg-green-500" },
              { label: "75th Percentile", value: matchingBenchmark.fee_p75, color: "bg-orange-500" },
              { label: "90th Percentile", value: matchingBenchmark.fee_p90, color: "bg-violet-600" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{formatFee(item.value)}</span>
                </div>
                <div className="h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", item.color)}
                    style={{
                      width: `${getBarWidth(item.value, matchingBenchmark.fee_p90 || 1)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">What This Means</h4>
            <p className="text-sm text-muted-foreground">
              For <strong>{EXPERIENCE_LEVELS.find(l => l.value === experienceLevel)?.label}</strong> speakers 
              in <strong>{topicCategory}</strong> speaking at <strong>{EVENT_TYPES.find(t => t.value === eventType)?.label}</strong> events, 
              fees typically range from {formatFee(matchingBenchmark.fee_p25)} to {formatFee(matchingBenchmark.fee_p90)}. 
              The median fee is {formatFee(matchingBenchmark.fee_median)}.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No Data Available</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We don't have benchmark data for this specific combination yet. 
            Try adjusting your filters or check back later as we expand our data.
          </p>
        </Card>
      )}
    </div>
  );
}
