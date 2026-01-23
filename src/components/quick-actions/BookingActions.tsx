import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BookingActionsProps {
  booking: {
    id: string;
    event_name: string;
    confirmed_fee: number;
    event_date?: string | null;
  };
  onCreateInvoice?: (booking: any) => void;
  onRequestFeedback?: (booking: any) => void;
}

export function BookingActions({
  booking,
  onCreateInvoice,
  onRequestFeedback,
}: BookingActionsProps) {
  const [requesting, setRequesting] = useState(false);

  const handleRequestFeedback = async () => {
    if (onRequestFeedback) {
      onRequestFeedback(booking);
      return;
    }

    setRequesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Create a testimonial request
      const requestToken = crypto.randomUUID();
      const { error } = await supabase.from("testimonials").insert({
        speaker_id: session.user.id,
        author_name: "Pending",
        quote: "Awaiting response",
        event_name: booking.event_name,
        event_date: booking.event_date,
        source: "request",
        request_token: requestToken,
        request_sent_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Feedback request created! Share the link with your client.");
    } catch (error) {
      console.error("Error creating feedback request:", error);
      toast.error("Failed to create feedback request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {onCreateInvoice && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCreateInvoice(booking);
              }}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create Invoice</p>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleRequestFeedback();
            }}
            disabled={requesting}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Request Feedback</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
