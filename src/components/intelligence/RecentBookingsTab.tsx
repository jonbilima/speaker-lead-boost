import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Building2, Linkedin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SpeakerBooking {
  id: string;
  speaker_name: string;
  speaker_linkedin: string | null;
  event_name: string;
  organizer_name: string | null;
  organization_name: string | null;
  event_date: string | null;
  booking_announced_date: string | null;
  source_type: string | null;
}

export function RecentBookingsTab() {
  const [bookings, setBookings] = useState<SpeakerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookings = async () => {
      const { data, error } = await supabase
        .from("speaker_bookings")
        .select("*")
        .order("booking_announced_date", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading bookings:", error);
      } else {
        setBookings(data || []);
      }
      setLoading(false);
    };

    loadBookings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h3 className="font-semibold text-lg mb-2">We're Building This Data</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Our system is actively tracking speaker announcements and bookings across the industry. 
          Check back soon for insights on who's booking which speakers.
        </p>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3">
        {bookings.map((booking) => (
          <Card key={booking.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{booking.speaker_name}</h4>
                  {booking.speaker_linkedin && (
                    <a
                      href={booking.speaker_linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Booked for <span className="font-medium text-foreground">{booking.event_name}</span>
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {booking.organization_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {booking.organization_name}
                    </span>
                  )}
                  {booking.event_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(booking.event_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              {booking.source_type && (
                <Badge variant="secondary" className="text-xs">
                  {booking.source_type}
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
