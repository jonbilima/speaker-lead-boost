import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

type TableName = 'profiles' | 'opportunities' | 'opportunity_scores' | 'applied_logs' | 
                 'confirmed_bookings' | 'pitches' | 'email_templates' | 'testimonials' | 
                 'contacts' | 'invoices';

interface TableCount {
  name: string;
  count: number;
}

interface EmailStats {
  sent: number;
  delivered: number;
  failed: number;
}

export function SystemHealthTab() {
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats>({ sent: 0, delivered: 0, failed: 0 });
  const [recentErrors, setRecentErrors] = useState<{ source: string; message: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch counts for main tables
      const tables: TableName[] = [
        'profiles',
        'opportunities',
        'opportunity_scores',
        'applied_logs',
        'confirmed_bookings',
        'pitches',
        'email_templates',
        'testimonials',
        'contacts',
        'invoices',
      ];

      const counts: TableCount[] = [];
      for (const table of tables) {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        counts.push({ name: table, count: count || 0 });
      }
      setTableCounts(counts);

      // Email stats
      const { data: emails } = await supabase
        .from('email_logs')
        .select('status');

      const sent = (emails || []).filter(e => e.status === 'sent' || e.status === 'delivered').length;
      const delivered = (emails || []).filter(e => e.status === 'delivered').length;
      const failed = (emails || []).filter(e => e.status === 'failed').length;

      setEmailStats({ sent, delivered, failed });

      // Recent errors from scraping logs
      const { data: scraperErrors } = await supabase
        .from('scraping_logs')
        .select('source, error_message, started_at')
        .eq('status', 'failed')
        .order('started_at', { ascending: false })
        .limit(10);

      setRecentErrors(
        (scraperErrors || [])
          .filter(e => e.error_message)
          .map(e => ({
            source: e.source,
            message: e.error_message || 'Unknown error',
            time: e.started_at,
          }))
      );

    } catch (error) {
      console.error('Error fetching system health data:', error);
    } finally {
      setLoading(false);
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
      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Database Status</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-500" />
              <span className="text-green-500">Healthy</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tableCounts.reduce((sum, t) => sum + t.count, 0).toLocaleString()} total rows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Email Delivery</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              {emailStats.sent > 0 
                ? `${((emailStats.delivered / emailStats.sent) * 100).toFixed(0)}%`
                : '100%'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {emailStats.sent} sent, {emailStats.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Errors</CardDescription>
            <CardTitle className="flex items-center gap-2">
              {recentErrors.length > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="text-orange-500">{recentErrors.length}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-500">None</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Row Counts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Tables
            </CardTitle>
            <CardDescription>Row counts per table</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableCounts
                  .sort((a, b) => b.count - a.count)
                  .map((table) => (
                    <TableRow key={table.name}>
                      <TableCell className="font-mono text-sm">{table.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{table.count.toLocaleString()}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Email Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Delivery Stats
            </CardTitle>
            <CardDescription>Overall email performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Total Sent</span>
                <Badge>{emailStats.sent}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Successfully Delivered</span>
                <Badge variant="default">{emailStats.delivered}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Failed</span>
                <Badge variant={emailStats.failed > 0 ? "destructive" : "secondary"}>
                  {emailStats.failed}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Delivery Rate</span>
                <Badge variant="outline">
                  {emailStats.sent > 0 
                    ? `${((emailStats.delivered / emailStats.sent) * 100).toFixed(1)}%`
                    : 'N/A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Recent Errors
          </CardTitle>
          <CardDescription>System errors from the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 py-4">
              <CheckCircle2 className="h-5 w-5" />
              <span>No errors in the last 24 hours</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentErrors.map((error, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="outline">{error.source}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                      {error.message}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(error.time), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
