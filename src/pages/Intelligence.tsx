import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, Users, Building2, DollarSign, TrendingUp } from "lucide-react";
import { RecentBookingsTab } from "@/components/intelligence/RecentBookingsTab";
import { ActiveOrganizersTab } from "@/components/intelligence/ActiveOrganizersTab";
import { FeeBenchmarksTab } from "@/components/intelligence/FeeBenchmarksTab";
import { TrendingTopicsTab } from "@/components/intelligence/TrendingTopicsTab";

const Intelligence = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-violet-600" />
            Booking Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Market insights on speakers, fees, organizers, and trends
          </p>
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Recent Bookings</span>
              <span className="sm:hidden">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="organizers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Active Organizers</span>
              <span className="sm:hidden">Organizers</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Fee Benchmarks</span>
              <span className="sm:hidden">Fees</span>
            </TabsTrigger>
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trending Topics</span>
              <span className="sm:hidden">Trends</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <RecentBookingsTab />
          </TabsContent>

          <TabsContent value="organizers">
            <ActiveOrganizersTab />
          </TabsContent>

          <TabsContent value="fees">
            <FeeBenchmarksTab />
          </TabsContent>

          <TabsContent value="topics">
            <TrendingTopicsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Intelligence;
