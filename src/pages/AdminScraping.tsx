import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ScrapingLog {
  id: string;
  source: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  opportunities_found: number;
  opportunities_inserted: number;
  opportunities_updated: number;
  error_message: string | null;
}

export default function AdminScraping() {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<Record<string, boolean>>({});

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('scraping_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching scraping logs:', error);
      toast.error('Failed to load scraping logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const triggerScraping = async (source: string, functionName: string) => {
    setScraping(prev => ({ ...prev, [source]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { manual_trigger: true }
      });

      if (error) throw error;

      toast.success(`${source} scraping completed`, {
        description: `Found: ${data.found}, Inserted: ${data.inserted}, Updated: ${data.updated}`
      });

      fetchLogs();
    } catch (error) {
      console.error(`Error scraping ${source}:`, error);
      toast.error(`Failed to scrape ${source}`);
    } finally {
      setScraping(prev => ({ ...prev, [source]: false }));
    }
  };

  const triggerTopicExtraction = async () => {
    setScraping(prev => ({ ...prev, 'topics': true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('extract-opportunity-topics');

      if (error) throw error;

      toast.success('Topic extraction completed', {
        description: `Processed: ${data.processed}, Topics added: ${data.topicsAdded}`
      });
    } catch (error) {
      console.error('Error extracting topics:', error);
      toast.error('Failed to extract topics');
    } finally {
      setScraping(prev => ({ ...prev, 'topics': false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      'sessionize': { label: 'Sessionize', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'eventbrite': { label: 'Eventbrite', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
      'test': { label: 'Test', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      'papercall': { label: 'PaperCall', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    };
    
    const config = variants[source] || { label: source, className: '' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Scraping Management</h1>
          <p className="text-muted-foreground">
            Manually trigger scrapers and monitor scraping activity
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Test Data</CardTitle>
              <CardDescription>Generate 15 realistic mock CFP opportunities for testing</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => triggerScraping('Test', 'scrape-test')}
                disabled={scraping['Test']}
                className="w-full"
              >
                {scraping['Test'] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Test Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PaperCall.io</CardTitle>
              <CardDescription>Scrape open CFPs from PaperCall.io event directory</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => triggerScraping('PaperCall', 'scrape-papercall')}
                disabled={scraping['PaperCall']}
                className="w-full"
              >
                {scraping['PaperCall'] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Scrape PaperCall
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessionize</CardTitle>
              <CardDescription>Scrape speaking opportunities from Sessionize CFP API</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => triggerScraping('Sessionize', 'scrape-sessionize')}
                disabled={scraping['sessionize']}
                className="w-full"
              >
                {scraping['sessionize'] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Scrape Sessionize
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eventbrite</CardTitle>
              <CardDescription>Scrape speaking opportunities from Eventbrite API</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => triggerScraping('Eventbrite', 'scrape-eventbrite')}
                disabled={scraping['eventbrite']}
                className="w-full"
              >
                {scraping['eventbrite'] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Scrape Eventbrite
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topic Extraction</CardTitle>
              <CardDescription>Extract and tag topics for recent opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={triggerTopicExtraction}
                disabled={scraping['topics']}
                className="w-full"
                variant="secondary"
              >
                {scraping['topics'] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Extract Topics
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Scraping Logs</CardTitle>
              <CardDescription>Recent scraping activity and results</CardDescription>
            </div>
            <Button onClick={fetchLogs} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scraping logs yet. Try running a scraper!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Found</TableHead>
                      <TableHead className="text-right">Inserted</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const duration = log.completed_at
                        ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{getSourceBadge(log.source)}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>{format(new Date(log.started_at), 'MMM d, HH:mm')}</TableCell>
                          <TableCell>{duration ? `${duration}s` : '-'}</TableCell>
                          <TableCell className="text-right">{log.opportunities_found || 0}</TableCell>
                          <TableCell className="text-right">{log.opportunities_inserted || 0}</TableCell>
                          <TableCell className="text-right">{log.opportunities_updated || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {log.error_message || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
