import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Mail, Phone, Building, Calendar, Kanban } from "lucide-react";
import { InboundLead, LEAD_STATUSES } from "@/components/widget/WidgetTypes";

interface LeadDetailDialogProps {
  lead: InboundLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (leadId: string, status: string) => void;
  onUpdate: () => void;
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  onStatusChange,
  onUpdate,
}: LeadDetailDialogProps) {
  const [notes, setNotes] = useState(lead?.notes || "");
  const [saving, setSaving] = useState(false);

  if (!lead) return null;

  const handleSaveNotes = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("inbound_leads")
      .update({ notes })
      .eq("id", lead.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
      onUpdate();
    }
  };

  const statusInfo = LEAD_STATUSES.find(s => s.value === lead.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.name}
            <Badge className={statusInfo?.color}>
              {statusInfo?.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${lead.email}`} className="text-violet-600 hover:underline">
                {lead.email}
              </a>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{lead.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Received: {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>

          {/* Event Details */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
            <h4 className="font-medium">Event Details</h4>
            <div className="grid grid-cols-2 gap-2">
              {lead.event_name && (
                <div>
                  <span className="text-muted-foreground">Event:</span>{" "}
                  {lead.event_name}
                </div>
              )}
              {lead.event_type && (
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  {lead.event_type}
                </div>
              )}
              {lead.event_date && (
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {format(new Date(lead.event_date), "MMM d, yyyy")}
                </div>
              )}
              {lead.estimated_audience && (
                <div>
                  <span className="text-muted-foreground">Audience:</span>{" "}
                  {lead.estimated_audience}
                </div>
              )}
              {lead.budget_range && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Budget:</span>{" "}
                  <span className="font-medium text-green-600">{lead.budget_range}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          {lead.message && (
            <div>
              <Label className="text-sm text-muted-foreground">Message</Label>
              <p className="text-sm mt-1 p-3 bg-muted/30 rounded-lg">
                {lead.message}
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Status</Label>
            <Select 
              value={lead.status} 
              onValueChange={(v) => onStatusChange(lead.id, v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add private notes about this lead..."
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleSaveNotes}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => window.location.href = `mailto:${lead.email}`}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button variant="outline" className="flex-1">
              <Kanban className="h-4 w-4 mr-2" />
              Add to Pipeline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
