import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Calendar, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueStats {
  totalBookings: number;
  totalRevenue: number;
  averageFee: number;
  paidBookings: number;
}

interface IndustryData {
  industry: string;
  count: number;
}

interface TopSpeaker {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
}

export function RevenueBusinessTab() {
  const [stats, setStats] = useState<RevenueStats>({
    totalBookings: 0,
    totalRevenue: 0,
    averageFee: 0,
    paidBookings: 0,
  });
  const [industryData, setIndustryData] = useState<IndustryData[]>([]);
  const [topSpeakers, setTopSpeakers] = useState<TopSpeaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all bookings
      const { data: bookings } = await supabase
        .from('confirmed_bookings')
        .select('*');

      const allBookings = bookings || [];
      const totalBookings = allBookings.length;
      const totalRevenue = allBookings.reduce((sum, b) => sum + (b.confirmed_fee || 0), 0);
      const averageFee = totalBookings > 0 ? totalRevenue / totalBookings : 0;
      const paidBookings = allBookings.filter(b => b.payment_status === 'paid').length;

      setStats({
        totalBookings,
        totalRevenue,
        averageFee,
        paidBookings,
      });

      // Industry distribution from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, industries');

      const industryCounts: Record<string, number> = {};
      (profiles || []).forEach(p => {
        if (p.industries && Array.isArray(p.industries)) {
          p.industries.forEach((ind: string) => {
            industryCounts[ind] = (industryCounts[ind] || 0) + 1;
          });
        }
      });

      setIndustryData(
        Object.entries(industryCounts)
          .map(([industry, count]) => ({ industry, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );

      // Top speakers by revenue (anonymized)
      const speakerRevenue: Record<string, { bookings: number; revenue: number }> = {};
      allBookings.forEach(b => {
        if (!speakerRevenue[b.speaker_id]) {
          speakerRevenue[b.speaker_id] = { bookings: 0, revenue: 0 };
        }
        speakerRevenue[b.speaker_id].bookings++;
        speakerRevenue[b.speaker_id].revenue += b.confirmed_fee || 0;
      });

      const topSpeakerIds = Object.entries(speakerRevenue)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10);

      // Fetch speaker names
      const speakerIds = topSpeakerIds.map(([id]) => id);
      const { data: speakerProfiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', speakerIds);

      const nameMap: Record<string, string> = {};
      (speakerProfiles || []).forEach(p => {
        nameMap[p.id] = p.name || 'Anonymous';
      });

      setTopSpeakers(
        topSpeakerIds.map(([id, data], index) => ({
          id,
          name: `Speaker ${index + 1}`, // Anonymized
          bookings: data.bookings,
          revenue: data.revenue,
        }))
      );

    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
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
            <CardDescription>Total Bookings</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              {stats.totalBookings}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue Tracked</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-500" />
              {formatCurrency(stats.totalRevenue)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Fee</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              {formatCurrency(stats.averageFee)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid Bookings</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Award className="h-6 w-6 text-purple-500" />
              {stats.paidBookings}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats.totalBookings > 0 
                ? `${((stats.paidBookings / stats.totalBookings) * 100).toFixed(0)}% paid`
                : '0% paid'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Speakers by Industry</CardTitle>
            <CardDescription>Distribution of speakers across industries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={industryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="industry" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Earning Speakers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Earning Speakers</CardTitle>
            <CardDescription>Anonymized for privacy</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Speaker</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSpeakers.map((speaker, index) => (
                  <TableRow key={speaker.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{speaker.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{speaker.bookings}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(speaker.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
                {topSpeakers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No booking data yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
