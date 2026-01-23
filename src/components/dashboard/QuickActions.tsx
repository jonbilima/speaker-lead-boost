import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, User, Upload, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickActionsProps {
  onRefreshOpportunities: () => void;
  isRefreshing?: boolean;
}

export const QuickActions = ({ onRefreshOpportunities, isRefreshing }: QuickActionsProps) => {
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          onClick={onRefreshOpportunities}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          <span>Find New Opportunities</span>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          asChild
        >
          <Link to="/profile">
            <User className="h-5 w-5" />
            <span>Update Profile</span>
          </Link>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          asChild
        >
          <Link to="/assets">
            <Upload className="h-5 w-5" />
            <span>Upload Assets</span>
          </Link>
        </Button>
      </div>
    </Card>
  );
};
