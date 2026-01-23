import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, Mail, Calendar, Building, DollarSign, 
  MessageSquare, MoreHorizontal, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { InboundLead, LEAD_STATUSES } from "@/components/widget/WidgetTypes";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Leads = () => {
  const [leads, setLeads] = useState<InboundLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "budget">("date");
  const [selectedLead, setSelectedLead] = useState<InboundLead | null>(null);

  const loadLeads = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);
    
    let query = supabase
      .from("inbound_leads")
      .select("*")
      .eq("speaker_id", session.user.id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load leads");
    } else {
      setLeads((data || []) as InboundLead[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase
      .from("inbound_leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      loadLeads();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = LEAD_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color || "bg-gray-100 text-gray-700"}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const filteredLeads = leads
    .filter(lead => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          lead.name.toLowerCase().includes(search) ||
          lead.email.toLowerCase().includes(search) ||
          lead.company?.toLowerCase().includes(search) ||
          lead.event_name?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // Sort by budget - extract numeric value
      const getBudgetValue = (budget?: string) => {
        if (!budget) return 0;
        const match = budget.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };
      return getBudgetValue(b.budget_range) - getBudgetValue(a.budget_range);
    });

  const newLeadsCount = leads.filter(l => l.status === "new").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-violet-600" />
              Inbound Leads
              {newLeadsCount > 0 && (
                <Badge className="bg-violet-600 text-white ml-2">{newLeadsCount} new</Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage inquiries from your embedded widget and profile
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadLeads}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
              {LEAD_STATUSES.map(status => {
                const count = leads.filter(l => l.status === status.value).length;
                return (
                  <TabsTrigger key={status.value} value={status.value}>
                    {status.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "budget")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="budget">Sort by Budget</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="font-medium mb-2">No leads yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Leads will appear here when people submit inquiries through your widget
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{lead.name}</h3>
                      {getStatusBadge(lead.status)}
                      <Badge variant="outline" className="text-xs">
                        {lead.source}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </span>
                      {lead.company && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {lead.company}
                        </span>
                      )}
                      {lead.event_name && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {lead.event_name}
                        </span>
                      )}
                      {lead.budget_range && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {lead.budget_range}
                        </span>
                      )}
                    </div>

                    {lead.message && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        <MessageSquare className="h-3 w-3 inline mr-1" />
                        {lead.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </span>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `mailto:${lead.email}`;
                        }}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        {LEAD_STATUSES.map(status => (
                          <DropdownMenuItem
                            key={status.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLeadStatus(lead.id, status.value);
                            }}
                          >
                            Mark as {status.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        onStatusChange={updateLeadStatus}
        onUpdate={loadLeads}
      />
    </AppLayout>
  );
};

export default Leads;
