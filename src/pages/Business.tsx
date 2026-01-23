import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Revenue from "./Revenue";
import Leads from "./Leads";

// Business page merges Revenue + Leads
const Business = () => {
  const [activeTab, setActiveTab] = useState("revenue");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Business</h1>
          <p className="text-muted-foreground">Manage revenue, invoices, and leads</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue" className="mt-6">
            <RevenueContent />
          </TabsContent>
          <TabsContent value="leads" className="mt-6">
            <LeadsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// Inline revenue content without AppLayout wrapper
function RevenueContent() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      Revenue tracking coming soon. Visit <a href="/revenue" className="text-primary underline">Revenue page</a> for now.
    </div>
  );
}

function LeadsContent() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      Leads management coming soon. Visit <a href="/leads" className="text-primary underline">Leads page</a> for now.
    </div>
  );
}

export default Business;
