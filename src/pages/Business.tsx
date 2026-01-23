import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BusinessOverview } from "@/components/business/BusinessOverview";
import { InvoicesTab } from "@/components/business/InvoicesTab";
import { ContactsTab } from "@/components/business/ContactsTab";
import { ReportsTab } from "@/components/business/ReportsTab";

const Business = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Business</h1>
          <p className="text-muted-foreground">Manage revenue, invoices, and contacts</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <BusinessOverview userId={user?.id} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <InvoicesTab userId={user?.id} />
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <ContactsTab userId={user?.id} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ReportsTab userId={user?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Business;