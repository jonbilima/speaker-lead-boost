import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Star, Sparkles, Plus } from "lucide-react";
import { Opportunity } from "@/pages/Find";

interface SmartListsSidebarProps {
  activeList: string | null;
  onSelectList: (listId: string) => void;
  opportunities: Opportunity[];
}

export function SmartListsSidebar({ activeList, onSelectList, opportunities }: SmartListsSidebarProps) {
  // Calculate counts for smart lists
  const closingSoonCount = opportunities.filter(opp => {
    if (!opp.deadline || opp.pipeline_stage) return false;
    const days = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 14;
  }).length;

  const perfectMatchesCount = opportunities.filter(opp => 
    opp.ai_score >= 85 && (!opp.pipeline_stage || opp.pipeline_stage === "new")
  ).length;

  const newThisWeekCount = opportunities.filter(opp => 
    !opp.pipeline_stage || opp.pipeline_stage === "new"
  ).length; // In reality, would filter by created_at

  const smartLists = [
    {
      id: "closing-soon",
      name: "Closing Soon",
      description: "Deadline within 14 days",
      icon: Clock,
      count: closingSoonCount,
      color: "text-orange-600",
    },
    {
      id: "perfect-matches",
      name: "Perfect Matches",
      description: "85%+ match score",
      icon: Star,
      count: perfectMatchesCount,
      color: "text-green-600",
    },
    {
      id: "new-this-week",
      name: "New This Week",
      description: "Recently added",
      icon: Sparkles,
      count: newThisWeekCount,
      color: "text-primary",
    },
  ];

  return (
    <Card className="sticky top-4" data-tour="smart-lists">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">My Smart Lists</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {smartLists.map(list => (
          <Button
            key={list.id}
            variant={activeList === list.id ? "secondary" : "ghost"}
            className="w-full justify-start h-auto py-2"
            onClick={() => onSelectList(list.id)}
          >
            <list.icon className={`h-4 w-4 mr-2 ${list.color}`} />
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{list.name}</span>
                <Badge variant="secondary" className="ml-2">
                  {list.count}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{list.description}</p>
            </div>
          </Button>
        ))}
        
        <div className="pt-2 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" disabled>
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-sm">Save Custom Search</span>
          </Button>
          <p className="text-xs text-muted-foreground px-2 mt-1">Coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
}