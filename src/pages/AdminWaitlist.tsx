import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Users, TrendingUp, Share2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  source: string;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

const AdminWaitlist = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    referrals: 0,
  });

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has admin role
      const { data: hasRole } = await supabase.rpc('has_role', {
        _role: 'admin',
        _user_id: user.id
      });

      if (!hasRole) {
        toast.error("You don't have permission to view this page");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await loadWaitlist();
    } catch (error) {
      console.error("Admin check error:", error);
      navigate("/");
    }
  };

  const loadWaitlist = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntries(data || []);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayEntries = (data || []).filter(e => 
        e.created_at.startsWith(today)
      );
      const referralEntries = (data || []).filter(e => 
        e.source === 'referral'
      );

      setStats({
        total: data?.length || 0,
        today: todayEntries.length,
        referrals: referralEntries.length,
      });
    } catch (error) {
      console.error("Load waitlist error:", error);
      toast.error("Failed to load waitlist");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (entries.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ['Email', 'Source', 'Referral Code', 'Referred By', 'Signed Up'];
    const rows = entries.map(e => [
      e.email,
      e.source,
      e.referral_code || '',
      e.referred_by || '',
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

    toast.success(`Exported ${entries.length} entries`);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Waitlist Management</h1>
              <p className="text-muted-foreground">View and export waitlist signups</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadWaitlist} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Signups</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="h-6 w-6 text-accent" />
                {stats.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-500" />
                {stats.today}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>From Referrals</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Share2 className="h-6 w-6 text-blue-500" />
                {stats.referrals}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Signups</CardTitle>
            <CardDescription>
              {entries.length} total entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No waitlist signups yet
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Referred By</TableHead>
                      <TableHead>Signed Up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, index) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">
                          {entries.length - index}
                        </TableCell>
                        <TableCell className="font-medium">{entry.email}</TableCell>
                        <TableCell>
                          <Badge variant={entry.source === 'referral' ? 'default' : 'secondary'}>
                            {entry.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.referral_code || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.referred_by || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminWaitlist;