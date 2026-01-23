import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, DollarSign, MapPin, Mic, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Opportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  deadline: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  location: string | null;
  ai_score: number;
  topics: string[];
}

interface TopOpportunitiesProps {
  opportunities: Opportunity[];
  onViewDetails: (opp: Opportunity) => void;
  loading?: boolean;
}

export const TopOpportunities = ({ opportunities, onViewDetails, loading }: TopOpportunitiesProps) => {
  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return "No deadline";
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "Passed";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-muted";
  };

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top Opportunities</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Top Opportunities</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/pipeline" className="flex items-center gap-1">
            View Pipeline <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      {opportunities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No opportunities yet</p>
          <p className="text-sm">
            Complete your profile to start receiving personalized speaking gigs
          </p>
          <Button 
            className="mt-4 bg-violet-600 hover:bg-violet-700"
            asChild
          >
            <Link to="/profile">Complete Profile</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <Card 
              key={opp.id} 
              className="p-4 hover:border-violet-300 transition-colors cursor-pointer" 
              onClick={() => onViewDetails(opp)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-lg ${getScoreColor(opp.ai_score)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xl font-bold text-white">{opp.ai_score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold">{opp.event_name}</h3>
                      {opp.organizer_name && (
                        <p className="text-sm text-muted-foreground">{opp.organizer_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {opp.topics.slice(0, 3).map((topic, i) => (
                      <Badge key={i} variant="secondary">{topic}</Badge>
                    ))}
                    {opp.topics.length > 3 && (
                      <Badge variant="outline">+{opp.topics.length - 3}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {opp.deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDeadline(opp.deadline)}
                      </div>
                    )}
                    {opp.fee_estimate_min && opp.fee_estimate_max && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${opp.fee_estimate_min.toLocaleString()} - ${opp.fee_estimate_max.toLocaleString()}
                      </div>
                    )}
                    {opp.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {opp.location}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      className="bg-violet-600 hover:bg-violet-700" 
                      onClick={(e) => { e.stopPropagation(); onViewDetails(opp); }}
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => { e.stopPropagation(); onViewDetails(opp); }}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Pitch
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};
