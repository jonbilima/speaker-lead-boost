import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Download, Users, FileCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface UnverifiedOpportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  submitted_by: string | null;
  created_at: string;
  is_featured: boolean;
}

interface WaitlistEntry {
  id: string;
  email: string;
  source: string;
  created_at: string;
}

export function AdminActionsTab() {
  const [unverifiedOpps, setUnverifiedOpps] = useState<UnverifiedOpportunity[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch unverified opportunities
      const { data: opps } = await supabase
        .from('opportunities')
        .select('id, event_name, organizer_name, submitted_by, created_at, is_featured')
        .eq('is_verified', false)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      setUnverifiedOpps(opps || []);

      // Fetch waitlist
      const { data: waitlistData } = await supabase
        .from('waitlist')
        .select('id, email, source, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      setWaitlist(waitlistData || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyOpportunity = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      // Note: This requires admin privileges via edge function or service role
      const { error } = await supabase
        .from('opportunities')
        .update({ is_verified: true })
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity verified');
      setUnverifiedOpps(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Error verifying opportunity:', error);
      toast.error('Failed to verify opportunity');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleFeatured = async (id: string, currentState: boolean) => {
    setActionLoading(prev => ({ ...prev, [`feature-${id}`]: true }));
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ is_featured: !currentState })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentState ? 'Removed from featured' : 'Added to featured');
      setUnverifiedOpps(prev => prev.map(o => 
        o.id === id ? { ...o, is_featured: !currentState } : o
      ));
    } catch (error) {
      console.error('Error toggling featured:', error);
      toast.error('Failed to update featured status');
    } finally {
      setActionLoading(prev => ({ ...prev, [`feature-${id}`]: false }));
    }
  };

  const exportWaitlistCSV = () => {
    if (waitlist.length === 0) {
      toast.error('No entries to export');
      return;
    }

    const headers = ['Email', 'Source', 'Signed Up'];
    const rows = waitlist.map(e => [
      e.email,
      e.source,
      format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nextmic-waitlist-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${waitlist.length} entries`);
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
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Verification</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <FileCheck className="h-6 w-6 text-orange-500" />
              {unverifiedOpps.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Waitlist Signups</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-500" />
              {waitlist.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="flex items-center justify-center">
          <Button onClick={exportWaitlistCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Waitlist CSV
          </Button>
        </Card>
      </div>

      {/* Unverified Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Pending Verification
          </CardTitle>
          <CardDescription>User-submitted opportunities awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {unverifiedOpps.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 py-4">
              <CheckCircle2 className="h-5 w-5" />
              <span>All opportunities are verified</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unverifiedOpps.map((opp) => (
                  <TableRow key={opp.id}>
                    <TableCell className="font-medium">{opp.event_name}</TableCell>
                    <TableCell>{opp.organizer_name || '-'}</TableCell>
                    <TableCell>{format(new Date(opp.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Switch
                        checked={opp.is_featured}
                        onCheckedChange={() => toggleFeatured(opp.id, opp.is_featured)}
                        disabled={actionLoading[`feature-${opp.id}`]}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => verifyOpportunity(opp.id)}
                        disabled={actionLoading[opp.id]}
                      >
                        {actionLoading[opp.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Verify
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Waitlist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Waitlist
          </CardTitle>
          <CardDescription>Recent waitlist signups</CardDescription>
        </CardHeader>
        <CardContent>
          {waitlist.length === 0 ? (
            <p className="text-muted-foreground py-4">No waitlist signups yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Signed Up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitlist.slice(0, 20).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.source}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(entry.created_at), 'MMM d, yyyy')}</TableCell>
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
