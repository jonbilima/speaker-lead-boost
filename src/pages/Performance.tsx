import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestFeedbackTab } from "@/components/performance/RequestFeedbackTab";
import { FeedbackReceivedTab } from "@/components/performance/FeedbackReceivedTab";
import { AnalyticsDashboardTab } from "@/components/performance/AnalyticsDashboardTab";
import { SelfReflectionTab } from "@/components/performance/SelfReflectionTab";
import { Send, MessageSquare, BarChart3, Brain } from "lucide-react";

export default function Performance() {
  const [activeTab, setActiveTab] = useState("request");

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Performance & Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Collect feedback, track your performance, and continuously improve
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="request" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Request</span>
            </TabsTrigger>
            <TabsTrigger value="received" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Received</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="reflection" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Reflect</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="mt-6">
            <RequestFeedbackTab />
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            <FeedbackReceivedTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboardTab />
          </TabsContent>

          <TabsContent value="reflection" className="mt-6">
            <SelfReflectionTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
