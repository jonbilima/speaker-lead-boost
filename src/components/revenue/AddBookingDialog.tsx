import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Booking } from "./BookingsTable";

interface AddBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  editingBooking?: Booking | null;
  prefillData?: {
    matchId?: string;
    eventName?: string;
    eventDate?: string;
  };
}

export function AddBookingDialog({
  open,
  onOpenChange,
  userId,
  onSuccess,
  editingBooking,
  prefillData,
}: AddBookingDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    event_name: "",
    event_date: "",
    confirmed_fee: "",
    payment_status: "pending",
    amount_paid: "0",
    expenses: "0",
    notes: "",
  });

  useEffect(() => {
    if (editingBooking) {
      setFormData({
        event_name: editingBooking.event_name,
        event_date: editingBooking.event_date || "",
        confirmed_fee: editingBooking.confirmed_fee.toString(),
        payment_status: editingBooking.payment_status,
        amount_paid: editingBooking.amount_paid.toString(),
        expenses: editingBooking.expenses?.toString() || "0",
        notes: editingBooking.notes || "",
      });
    } else if (prefillData) {
      setFormData((prev) => ({
        ...prev,
        event_name: prefillData.eventName || "",
        event_date: prefillData.eventDate || "",
      }));
    } else {
      setFormData({
        event_name: "",
        event_date: "",
        confirmed_fee: "",
        payment_status: "pending",
        amount_paid: "0",
        expenses: "0",
        notes: "",
      });
    }
  }, [editingBooking, prefillData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.event_name.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!formData.confirmed_fee || parseFloat(formData.confirmed_fee) <= 0) {
      toast.error("Please enter a valid fee amount");
      return;
    }

    setSaving(true);
    try {
      const bookingData = {
        speaker_id: userId,
        event_name: formData.event_name,
        event_date: formData.event_date || null,
        confirmed_fee: parseFloat(formData.confirmed_fee),
        payment_status: formData.payment_status,
        amount_paid: parseFloat(formData.amount_paid) || 0,
        expenses: parseFloat(formData.expenses) || 0,
        notes: formData.notes || null,
        match_id: prefillData?.matchId || null,
      };

      if (editingBooking) {
        const { error } = await supabase
          .from("confirmed_bookings")
          .update(bookingData)
          .eq("id", editingBooking.id);

        if (error) throw error;
        toast.success("Booking updated!");
      } else {
        const { error } = await supabase
          .from("confirmed_bookings")
          .insert(bookingData);

        if (error) throw error;
        toast.success("Booking added!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving booking:", error);
      toast.error("Failed to save booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingBooking ? "Edit Booking" : "Add Confirmed Booking"}
          </DialogTitle>
          <DialogDescription>
            {editingBooking
              ? "Update the booking details"
              : "Record a confirmed speaking engagement"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event_name">Event Name *</Label>
            <Input
              id="event_name"
              value={formData.event_name}
              onChange={(e) =>
                setFormData({ ...formData, event_name: e.target.value })
              }
              placeholder="Conference name or event"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) =>
                  setFormData({ ...formData, event_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmed_fee">Confirmed Fee ($) *</Label>
              <Input
                id="confirmed_fee"
                type="number"
                value={formData.confirmed_fee}
                onChange={(e) =>
                  setFormData({ ...formData, confirmed_fee: e.target.value })
                }
                placeholder="5000"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_status">Payment Status</Label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount Received ($)</Label>
              <Input
                id="amount_paid"
                type="number"
                value={formData.amount_paid}
                onChange={(e) =>
                  setFormData({ ...formData, amount_paid: e.target.value })
                }
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expenses">Expenses ($)</Label>
            <Input
              id="expenses"
              type="number"
              value={formData.expenses}
              onChange={(e) =>
                setFormData({ ...formData, expenses: e.target.value })
              }
              placeholder="Travel, accommodations, etc."
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingBooking
                ? "Update Booking"
                : "Add Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
