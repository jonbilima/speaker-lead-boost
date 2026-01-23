import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScrapingStats {
  lastUpdate: Date | null;
  isRunning: boolean;
  totalOpportunities: number;
  sourcesCount: number;
}

export function DataFreshnessIndicator() {
  const [stats, setStats] = useState<ScrapingStats>({
    lastUpdate: null,
    isRunning: false,
    totalOpportunities: 0,
    sourcesCount: 0,
  });

  const fetchStats = async () => {
    try {
      // Get most recent successful scrape
      const { data: logs } = await supabase
        .from('scraping_logs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (logs && logs.length > 0) {
        const completedLogs = logs.filter(l => l.status === 'success' || l.status === 'partial');
        const runningLogs = logs.filter(l => l.status === 'running');
        const uniqueSources = new Set(completedLogs.map(l => l.source));

        const lastCompleted = completedLogs[0];
        
        setStats({
          lastUpdate: lastCompleted?.completed_at ? new Date(lastCompleted.completed_at) : null,
          isRunning: runningLogs.length > 0,
          totalOpportunities: completedLogs.reduce((sum, l) => sum + (l.opportunities_found || 0), 0),
          sourcesCount: uniqueSources.size,
        });
      }

      // Also get total opportunities count
      const { count } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (count !== null) {
        setStats(prev => ({ ...prev, totalOpportunities: count }));
      }
    } catch (error) {
      console.error('Error fetching scraping stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getAgeStatus = () => {
    if (stats.isRunning) return 'updating';
    if (!stats.lastUpdate) return 'unknown';
    
    const hoursAgo = (Date.now() - stats.lastUpdate.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 6) return 'fresh';
    if (hoursAgo < 24) return 'recent';
    return 'stale';
  };

  const status = getAgeStatus();

  if (status === 'updating') {
    return (
      <Badge variant="secondary" className="gap-1.5 animate-pulse">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Updating...
      </Badge>
    );
  }

  if (status === 'unknown') {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <Clock className="h-3 w-3" />
        No data yet
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={status === 'stale' ? 'destructive' : 'outline'}
            className={`gap-1.5 cursor-help ${
              status === 'fresh' ? 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800' :
              status === 'recent' ? 'text-muted-foreground' :
              ''
            }`}
          >
            {status === 'stale' ? (
              <AlertTriangle className="h-3 w-3" />
            ) : status === 'fresh' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {stats.lastUpdate && formatDistanceToNow(stats.lastUpdate, { addSuffix: true })}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <p className="font-medium">
              {stats.totalOpportunities.toLocaleString()} opportunities
            </p>
            <p className="text-muted-foreground">
              From {stats.sourcesCount} sources
            </p>
            {status === 'stale' && (
              <p className="text-destructive">
                Data may be outdated (&gt;24 hours old)
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
