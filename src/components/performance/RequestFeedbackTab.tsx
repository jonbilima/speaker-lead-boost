import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Clock, CheckCircle2, Eye, RefreshCw, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

interface Booking {
  id: string;
  event_name: string;
  event_date: string | null;
  confirmed_fee: number;
}

interface FeedbackRequest {
  id: string;
  booking_id: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  reminder_sent_at: string | null;
}

export function RequestFeedbackTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    recipientEmail: "",
    recipientName: "",
    customMessage: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch completed bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("confirmed_bookings")
        .select("id, event_name, event_date, confirmed_fee")
        .eq("speaker_id", user.id)
        .order("event_date", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch existing feedback requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("feedback_requests")
        .select("*")
        .eq("speaker_id", user.id);

      if (requestsError) throw requestsError;

      setBookings(bookingsData || []);
      setRequests(requestsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRequestForBooking = (bookingId: string) => {
    return requests.find((r) => r.booking_id === bookingId);
  };

  const getStatusBadge = (request: FeedbackRequest | undefined) => {
    if (!request) return null;
    
    switch (request.status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "opened":
        return <Badge className="bg-blue-500/10 text-blue-600"><Eye className="h-3 w-3 mr-1" /> Opened</Badge>;
      case "sent":
        return <Badge className="bg-yellow-500/10 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> Sent</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const canSendReminder = (request: FeedbackRequest | undefined) => {
    if (!request || request.status === "completed") return false;
    if (!request.sent_at) return false;
    
    const daysSinceSent = differenceInDays(new Date(), new Date(request.sent_at));
    const daysSinceReminder = request.reminder_sent_at 
      ? differenceInDays(new Date(), new Date(request.reminder_sent_at))
      : daysSinceSent;
    
    return daysSinceSent >= 5 && daysSinceReminder >= 5;
  };

  const openRequestDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setFormData({ recipientEmail: "", recipientName: "", customMessage: "" });
    setDialogOpen(true);
  };

  const sendFeedbackRequest = async (isReminder = false) => {
    if (!selectedBooking) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.functions.invoke("send-feedback-request", {
        body: {
          bookingId: selectedBooking.id,
          recipientEmail: formData.recipientEmail,
          recipientName: formData.recipientName,
          eventName: selectedBooking.event_name,
          eventDate: selectedBooking.event_date,
          speakerName: profile?.name || "the speaker",
          customMessage: formData.customMessage,
          isReminder,
        },
      });

      if (error) throw error;

      toast({ title: isReminder ? "Reminder sent!" : "Feedback request sent!" });
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error sending request:", error);
      toast({ title: "Error sending request", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Request Feedback</h2>
          <p className="text-muted-foreground">
            Send feedback requests for completed events
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button>
            <Send className="h-4 w-4 mr-2" />
            Bulk Request ({selectedIds.size})
          </Button>
        )}
      </div>

      {bookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No completed bookings yet</h3>
            <p className="text-muted-foreground text-center">
              Complete a booking to start collecting feedback
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const request = getRequestForBooking(booking.id);
            const showReminder = canSendReminder(request);

            return (
              <Card key={booking.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedIds.has(booking.id)}
                      onCheckedChange={() => toggleSelection(booking.id)}
                      disabled={request?.status === "completed"}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{booking.event_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {booking.event_date
                          ? format(new Date(booking.event_date), "MMM d, yyyy")
                          : "No date set"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(request)}
                      
                      {!request ? (
                        <Button size="sm" onClick={() => openRequestDialog(booking)}>
                          <Send className="h-4 w-4 mr-2" />
                          Request
                        </Button>
                      ) : showReminder ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setFormData({
                              recipientEmail: request.recipient_email,
                              recipientName: request.recipient_name || "",
                              customMessage: "",
                            });
                            sendFeedbackRequest(true);
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Remind
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Feedback</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedBooking?.event_name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedBooking?.event_date
                  ? format(new Date(selectedBooking.event_date), "MMMM d, yyyy")
                  : ""}
              </p>
            </div>

            <div>
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                placeholder="organizer@example.com"
              />
            </div>

            <div>
              <Label>Recipient Name</Label>
              <Input
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                placeholder="Their name"
              />
            </div>

            <div>
              <Label>Custom Message (optional)</Label>
              <Textarea
                value={formData.customMessage}
                onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                placeholder="Add a personal message..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendFeedbackRequest(false)}
              disabled={!formData.recipientEmail || sending}
            >
              {sending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
