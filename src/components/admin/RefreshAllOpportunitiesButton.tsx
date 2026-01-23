import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ScrapingStats {
  lastScrape: Date | null;
  totalFound: number;
  sourcesUsed: string[];
}

export function RefreshAllOpportunitiesButton() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ScrapingStats>({
    lastScrape: null,
    totalFound: 0,
    sourcesUsed: [],
  });

  const fetchLastScrapeStats = async () => {
    try {
      // Get most recent all-sources scrape
      const { data: allSourcesLog } = await supabase
        .from('scraping_logs')
        .select('*')
        .eq('source', 'all-sources')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (allSourcesLog) {
        setStats({
          lastScrape: new Date(allSourcesLog.completed_at!),
          totalFound: allSourcesLog.opportunities_found || 0,
          sourcesUsed: ['papercall', 'sessionize', 'eventbrite'],
        });
        return;
      }

      // Fallback: get recent individual scrapes
      const { data: recentLogs } = await supabase
        .from('scraping_logs')
        .select('*')
        .in('status', ['success', 'partial'])
        .order('completed_at', { ascending: false })
        .limit(5);

      if (recentLogs && recentLogs.length > 0) {
        const uniqueSources = [...new Set(recentLogs.map(l => l.source))];
        const mostRecent = recentLogs[0];
        const totalFound = recentLogs.reduce((sum, l) => sum + (l.opportunities_found || 0), 0);

        setStats({
          lastScrape: mostRecent.completed_at ? new Date(mostRecent.completed_at) : null,
          totalFound,
          sourcesUsed: uniqueSources,
        });
      }
    } catch (error) {
      console.error('Error fetching scraping stats:', error);
    }
  };

  useEffect(() => {
    fetchLastScrapeStats();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-all-sources', {
        body: { manual_trigger: true },
      });

      if (error) throw error;

      toast.success("All scrapers completed!", {
        description: `Found: ${data.totals?.found || 0}, New: ${data.totals?.inserted || 0}`,
      });

      fetchLastScrapeStats();
    } catch (error) {
      console.error('Error running all scrapers:', error);
      toast.error("Failed to refresh opportunities", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleRefresh}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Refreshing All Sources...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Refresh All Opportunities
          </>
        )}
      </Button>

      {stats.lastScrape && (
        <div className="text-sm text-muted-foreground space-y-1 px-1">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Last updated: {formatDistanceToNow(stats.lastScrape, { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {stats.totalFound} opportunities from {stats.sourcesUsed.length} source{stats.sourcesUsed.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
