import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Activity, UserPlus } from "lucide-react";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface UserStats {
  totalUsers: number;
  newThisWeek: number;
  dau: number;
  mau: number;
}

interface DailySignup {
  date: string;
  count: number;
}

interface UserRow {
  id: string;
  name: string | null;
  created_at: string;
  last_active?: string;
  applications_count?: number;
}

export function UserMetricsTab() {
  const [stats, setStats] = useState<UserStats>({ totalUsers: 0, newThisWeek: 0, dau: 0, mau: 0 });
  const [dailySignups, setDailySignups] = useState<DailySignup[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const allProfiles = profiles || [];
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);
      const dayAgo = subDays(now, 1);

      // Calculate stats
      const totalUsers = allProfiles.length;
      const newThisWeek = allProfiles.filter(p => new Date(p.created_at) > weekAgo).length;

      // For DAU/MAU, we'll use opportunity_scores as activity indicator
      const { data: recentActivity } = await supabase
        .from('opportunity_scores')
        .select('user_id, calculated_at')
        .gte('calculated_at', monthAgo.toISOString());

      const uniqueMonthlyUsers = new Set((recentActivity || []).map(a => a.user_id));
      const uniqueDailyUsers = new Set(
        (recentActivity || [])
          .filter(a => new Date(a.calculated_at) > dayAgo)
          .map(a => a.user_id)
      );

      setStats({
        totalUsers,
        newThisWeek,
        dau: uniqueDailyUsers.size,
        mau: uniqueMonthlyUsers.size
      });

      // Calculate daily signups for last 30 days
      const signupsByDay: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(now, i), 'MMM d');
        signupsByDay[date] = 0;
      }

      allProfiles.forEach(p => {
        const date = format(new Date(p.created_at), 'MMM d');
        if (signupsByDay[date] !== undefined) {
          signupsByDay[date]++;
        }
      });

      setDailySignups(
        Object.entries(signupsByDay).map(([date, count]) => ({ date, count }))
      );

      // Fetch application counts per user
      const { data: applicationCounts } = await supabase
        .from('applied_logs')
        .select('user_id');

      const appCountMap: Record<string, number> = {};
      (applicationCounts || []).forEach(a => {
        appCountMap[a.user_id] = (appCountMap[a.user_id] || 0) + 1;
      });

      // Prepare user table data
      const usersWithActivity = allProfiles.slice(0, 50).map(p => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at,
        applications_count: appCountMap[p.id] || 0
      }));

      setUsers(usersWithActivity);
    } catch (error) {
      console.error('Error fetching user metrics:', error);
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {stats.totalUsers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <span className="text-green-500">+{stats.newThisWeek}</span> this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Active Users</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-500" />
              {stats.dau}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Active Users</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              {stats.mau}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New Signups This Week</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-purple-500" />
              {stats.newThisWeek}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {((stats.newThisWeek / Math.max(stats.totalUsers, 1)) * 100).toFixed(1)}% growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Signups Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Signups</CardTitle>
          <CardDescription>New user registrations over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySignups}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>Last 50 registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Signup Date</TableHead>
                <TableHead className="text-right">Applications</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || 'No name'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={user.applications_count && user.applications_count > 0 ? "default" : "secondary"}>
                      {user.applications_count || 0}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
