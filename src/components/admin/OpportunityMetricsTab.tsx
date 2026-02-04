import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, RefreshCw, Loader2, Play } from "lucide-react";
import { format, subDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";

interface SourceData {
  name: string;
  value: number;
  color: string;
}

interface ScraperStatus {
  source: string;
  lastRun: string | null;
  status: string;
  found: number;
}

export function OpportunityMetricsTab() {
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus[]>([]);
  const [topViewed, setTopViewed] = useState<{ name: string; views: number }[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState({
    viewed: 0,
    saved: 0,
    applied: 0,
    booked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [runningScrapers, setRunningScrapers] = useState<Record<string, boolean>>({});

  const SOURCE_COLORS: Record<string, string> = {
    'sessionize': '#3B82F6',
    'papercall': '#8B5CF6',
    'eventbrite': '#F97316',
    'meetup': '#EF4444',
    'manual': '#10B981',
    'test': '#6B7280',
    'conferencelist': '#EC4899',
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Total opportunities
      const { count } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      setTotalOpportunities(count || 0);

      // Opportunities by source
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('source')
        .eq('is_active', true);

      const sourceCounts: Record<string, number> = {};
      (opportunities || []).forEach(o => {
        const source = o.source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });

      setSourceData(
        Object.entries(sourceCounts)
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: SOURCE_COLORS[name] || '#6B7280',
          }))
          .sort((a, b) => b.value - a.value)
      );

      // Daily additions (last 30 days)
      const { data: allOpps } = await supabase
        .from('opportunities')
        .select('created_at')
        .gte('created_at', subDays(new Date(), 30).toISOString());

      const dailyCounts: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'MMM d');
        dailyCounts[date] = 0;
      }

      (allOpps || []).forEach(o => {
        const date = format(new Date(o.created_at), 'MMM d');
        if (dailyCounts[date] !== undefined) {
          dailyCounts[date]++;
        }
      });

      setDailyData(
        Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
      );

      // Scraper status from logs
      const { data: logs } = await supabase
        .from('scraping_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      const latestBySource: Record<string, ScraperStatus> = {};
      (logs || []).forEach(log => {
        if (!latestBySource[log.source]) {
          latestBySource[log.source] = {
            source: log.source,
            lastRun: log.started_at,
            status: log.status,
            found: log.opportunities_found || 0,
          };
        }
      });

      setScraperStatus(Object.values(latestBySource));

      // Top viewed opportunities
      const { data: scores } = await supabase
        .from('opportunity_scores')
        .select('opportunity_id, opportunities(event_name)')
        .not('viewed_at', 'is', null);

      const viewCounts: Record<string, { name: string; views: number }> = {};
      (scores || []).forEach((s: any) => {
        const id = s.opportunity_id;
        const name = s.opportunities?.event_name || 'Unknown';
        if (!viewCounts[id]) {
          viewCounts[id] = { name, views: 0 };
        }
        viewCounts[id].views++;
      });

      setTopViewed(
        Object.values(viewCounts)
          .sort((a, b) => b.views - a.views)
          .slice(0, 10)
      );

      // Conversion funnel
      const { data: allScores } = await supabase
        .from('opportunity_scores')
        .select('viewed_at, interested_at, pipeline_stage');

      const viewed = (allScores || []).filter(s => s.viewed_at).length;
      const saved = (allScores || []).filter(s => s.interested_at).length;
      const applied = (allScores || []).filter(s => 
        s.pipeline_stage && ['pitched', 'negotiating', 'accepted', 'completed'].includes(s.pipeline_stage)
      ).length;
      const booked = (allScores || []).filter(s => 
        s.pipeline_stage && ['accepted', 'completed'].includes(s.pipeline_stage)
      ).length;

      setConversionFunnel({ viewed, saved, applied, booked });

    } catch (error) {
      console.error('Error fetching opportunity metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScraper = async (source: string) => {
    setRunningScrapers(prev => ({ ...prev, [source]: true }));
    
    try {
      const functionMap: Record<string, string> = {
        'sessionize': 'scrape-sessionize',
        'papercall': 'scrape-papercall',
        'eventbrite': 'scrape-eventbrite',
        'test': 'scrape-test',
      };

      const functionName = functionMap[source.toLowerCase()];
      if (!functionName) {
        toast.error(`Unknown scraper: ${source}`);
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { manual_trigger: true }
      });

      if (error) throw error;

      toast.success(`${source} scraping completed`, {
        description: `Found: ${data.found || 0}, Inserted: ${data.inserted || 0}`
      });

      fetchData();
    } catch (error) {
      console.error(`Error scraping ${source}:`, error);
      toast.error(`Failed to run ${source} scraper`);
    } finally {
      setRunningScrapers(prev => ({ ...prev, [source]: false }));
    }
  };

  const runAllScrapers = async () => {
    setRunningScrapers({ all: true });
    try {
      const { error } = await supabase.functions.invoke('scrape-all-sources');
      if (error) throw error;
      toast.success('All scrapers completed');
      fetchData();
    } catch (error) {
      console.error('Error running all scrapers:', error);
      toast.error('Failed to run scrapers');
    } finally {
      setRunningScrapers({});
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Opportunities</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              {totalOpportunities}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Viewed</CardDescription>
            <CardTitle className="text-3xl">{conversionFunnel.viewed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Applied</CardDescription>
            <CardTitle className="text-3xl">{conversionFunnel.applied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Booked</CardDescription>
            <CardTitle className="text-3xl">{conversionFunnel.booked}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunities by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {sourceData.map((source) => (
                <Badge key={source.name} variant="outline" style={{ borderColor: source.color }}>
                  <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: source.color }} />
                  {source.name}: {source.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Additions */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Additions</CardTitle>
            <CardDescription>Opportunities added per day (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scraper Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Scraper Status</CardTitle>
            <CardDescription>Last run times and results</CardDescription>
          </div>
          <Button onClick={runAllScrapers} disabled={runningScrapers.all}>
            {runningScrapers.all ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run All Scrapers
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Found</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scraperStatus.map((scraper) => (
                <TableRow key={scraper.source}>
                  <TableCell className="font-medium capitalize">{scraper.source}</TableCell>
                  <TableCell>
                    {scraper.lastRun ? format(new Date(scraper.lastRun), 'MMM d, HH:mm') : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={scraper.status === 'success' ? 'default' : 'destructive'}>
                      {scraper.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{scraper.found}</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => triggerScraper(scraper.source)}
                      disabled={runningScrapers[scraper.source]}
                    >
                      {runningScrapers[scraper.source] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Viewed */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most Viewed Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Event Name</TableHead>
                <TableHead className="text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topViewed.map((opp, index) => (
                <TableRow key={opp.name + index}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{opp.name}</TableCell>
                  <TableCell className="text-right">{opp.views}</TableCell>
                </TableRow>
              ))}
              {topViewed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No view data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
