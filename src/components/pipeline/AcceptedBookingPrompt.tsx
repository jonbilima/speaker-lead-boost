import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerManualConfetti } from "@/hooks/useConfetti";

interface AcceptedBookingPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  eventName: string;
  eventDate: string | null;
  userId: string;
  /** Fee already agreed elsewhere (e.g. entered when adding a private gig). */
  initialFee?: number | null;
  onSuccess: () => void;
}

export function AcceptedBookingPrompt({
  open,
  onOpenChange,
  matchId,
  eventName,
  eventDate,
  userId,
  initialFee = null,
  onSuccess,
}: AcceptedBookingPromptProps) {
  const [saving, setSaving] = useState(false);
  const [confirmedFee, setConfirmedFee] = useState("");
  const [bookingDate, setBookingDate] = useState(
    eventDate ? eventDate.split("T")[0] : ""
  );

  // The prompt stays mounted between uses, so a useState initializer alone
  // would show the previous gig's date. Re-seed every time it opens.
  useEffect(() => {
    if (!open) return;
    setConfirmedFee(initialFee != null ? String(initialFee) : "");
    setBookingDate(eventDate ? eventDate.split("T")[0] : "");
  }, [open, matchId, initialFee, eventDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmedFee || parseFloat(confirmedFee) <= 0) {
      toast.error("Please enter a valid fee amount");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("confirmed_bookings").insert({
        speaker_id: userId,
        match_id: matchId,
        event_name: eventName,
        event_date: bookingDate || null,
        confirmed_fee: parseFloat(confirmedFee),
        payment_status: "pending",
      });

      if (error) throw error;

      toast.success("🎉 Congratulations on the booking!");
      triggerManualConfetti();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding booking:", error);
      toast.error("Failed to add booking");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    toast.info("You can add booking details later from the Revenue page");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 Congratulations!</DialogTitle>
          <DialogDescription>
            You've been accepted for <strong>{eventName}</strong>! Add the booking
            details to track your revenue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmed_fee">Confirmed Fee ($) *</Label>
            <Input
              id="confirmed_fee"
              type="number"
              value={confirmedFee}
              onChange={(e) => setConfirmedFee(e.target.value)}
              placeholder="5000"
              min="0"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking_date">Event Date</Label>
            <Input
              id="booking_date"
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
