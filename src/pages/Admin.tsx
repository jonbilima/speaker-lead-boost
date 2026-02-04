import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMetricsTab } from "@/components/admin/UserMetricsTab";
import { OnboardingFunnelTab } from "@/components/admin/OnboardingFunnelTab";
import { OpportunityMetricsTab } from "@/components/admin/OpportunityMetricsTab";
import { RevenueBusinessTab } from "@/components/admin/RevenueBusinessTab";
import { SystemHealthTab } from "@/components/admin/SystemHealthTab";
import { AdminActionsTab } from "@/components/admin/AdminActionsTab";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Briefcase, DollarSign, Activity, Settings } from "lucide-react";

export default function Admin() {
  const { isAdmin, loading } = useAdminCheck(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect via hook
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <Badge variant="secondary">Admin Only</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Platform analytics and management
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger 
              value="users" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger 
              value="funnel"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Funnel</span>
            </TabsTrigger>
            <TabsTrigger 
              value="opportunities"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Opportunities</span>
            </TabsTrigger>
            <TabsTrigger 
              value="revenue"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger 
              value="health"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
            <TabsTrigger 
              value="actions"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Actions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserMetricsTab />
          </TabsContent>

          <TabsContent value="funnel">
            <OnboardingFunnelTab />
          </TabsContent>

          <TabsContent value="opportunities">
            <OpportunityMetricsTab />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueBusinessTab />
          </TabsContent>

          <TabsContent value="health">
            <SystemHealthTab />
          </TabsContent>

          <TabsContent value="actions">
            <AdminActionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
