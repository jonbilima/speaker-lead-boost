import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight, Building, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { InboundLead, LEAD_STATUSES } from "@/components/widget/WidgetTypes";

export function InboundLeadsWidget() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<InboundLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentLeads();
  }, []);

  const loadRecentLeads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("inbound_leads")
      .select("*")
      .eq("speaker_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    setLeads((data || []) as InboundLead[]);
    setLoading(false);
  };

  const newLeadsCount = leads.filter(l => l.status === "new").length;

  const getStatusBadge = (status: string) => {
    const statusInfo = LEAD_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`text-xs ${statusInfo?.color || "bg-gray-100 text-gray-700"}`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" />
          Inbound Leads
          {newLeadsCount > 0 && (
            <Badge className="bg-violet-600 text-white text-xs">
              {newLeadsCount} new
            </Badge>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No leads yet</p>
          <p className="text-xs">Add the widget to your website to start receiving inquiries</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              onClick={() => navigate("/leads")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{lead.name}</span>
                    {getStatusBadge(lead.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {lead.company && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {lead.company}
                      </span>
                    )}
                    {lead.budget_range && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {lead.budget_range}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(lead.created_at), "MMM d")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
