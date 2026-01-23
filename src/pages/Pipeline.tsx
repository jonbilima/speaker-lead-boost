import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const pipelineStages = [
  { id: "new", label: "New", color: "bg-slate-100", count: 0 },
  { id: "researching", label: "Researching", color: "bg-blue-100", count: 0 },
  { id: "interested", label: "Interested", color: "bg-yellow-100", count: 0 },
  { id: "pitched", label: "Pitched", color: "bg-orange-100", count: 0 },
  { id: "negotiating", label: "Negotiating", color: "bg-purple-100", count: 0 },
  { id: "accepted", label: "Accepted", color: "bg-green-100", count: 0 },
];

const Pipeline = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Kanban className="h-6 w-6 text-violet-600" />
              Opportunity Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your speaking opportunities through each stage
            </p>
          </div>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Opportunity
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {pipelineStages.map((stage) => (
            <Card key={stage.id} className="min-h-[400px]">
              <CardHeader className={`${stage.color} rounded-t-lg`}>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {stage.label}
                  <span className="bg-white/80 text-xs px-2 py-0.5 rounded-full">
                    {stage.count}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No opportunities
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Pipeline;
