import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { 
  OrganizerResearchData, 
  EventHistoryItem, 
  SpeakerBookedItem,
  BookingInsights 
} from "@/components/organizer/OrganizerResearchTypes";

// Simple in-memory cache
const researchCache = new Map<string, OrganizerResearchData>();

export function useOrganizerResearch(organizerName: string | null) {
  const [data, setData] = useState<OrganizerResearchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResearch = useCallback(async () => {
    if (!organizerName) return;

    // Check cache first
    const cacheKey = organizerName.toLowerCase().trim();
    if (researchCache.has(cacheKey)) {
      setData(researchCache.get(cacheKey)!);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch organizer from organizers table
      const { data: organizerData } = await supabase
        .from("organizers")
        .select("*")
        .ilike("name", `%${organizerName}%`)
        .limit(1)
        .maybeSingle();

      // Fetch event history from opportunities
      const { data: events } = await supabase
        .from("opportunities")
        .select(`
          id,
          event_name,
          event_date,
          location,
          fee_estimate_min,
          fee_estimate_max,
          opportunity_topics (
            topics (name)
          )
        `)
        .or(`organizer_name.ilike.%${organizerName}%,organizer_email.ilike.%${organizerName}%`)
        .order("event_date", { ascending: false })
        .limit(20);

      // Fetch speakers they've booked
      const { data: speakerBookings } = await supabase
        .from("speaker_bookings")
        .select("*")
        .ilike("organizer_name", `%${organizerName}%`)
        .order("event_date", { ascending: false })
        .limit(15);

      // Process event history
      const eventHistory: EventHistoryItem[] = (events || []).map(e => ({
        id: e.id,
        event_name: e.event_name,
        event_date: e.event_date,
        location: e.location,
        fee_estimate_min: e.fee_estimate_min,
        fee_estimate_max: e.fee_estimate_max,
        topics: (e.opportunity_topics as any[])?.map((ot: any) => ot.topics?.name).filter(Boolean) || []
      }));

      // Process speakers booked
      const speakersBooked: SpeakerBookedItem[] = (speakerBookings || []).map(s => ({
        id: s.id,
        speaker_name: s.speaker_name,
        speaker_linkedin: s.speaker_linkedin,
        event_name: s.event_name,
        event_date: s.event_date
      }));

      // Calculate insights
      const insights = calculateInsights(eventHistory, speakersBooked);

      // Determine if we have limited data
      const hasLimitedData = eventHistory.length < 2 && speakersBooked.length < 2;

      const researchData: OrganizerResearchData = {
        organizer: {
          name: organizerData?.name || organizerName,
          email: organizerData?.email || null,
          phone: organizerData?.phone || null,
          linkedin_url: organizerData?.linkedin_url || null,
          organization_name: organizerData?.organization_name || null,
          organization_website: organizerData?.organization_website || null
        },
        eventHistory,
        speakersBooked,
        insights,
        approachStrategy: {
          talkingPoints: [],
          suggestedAngle: "",
          relevantTopics: [],
          loading: false
        },
        isLoading: false,
        isResearchInProgress: false,
        hasLimitedData
      };

      // Cache the result
      researchCache.set(cacheKey, researchData);
      setData(researchData);
    } catch (error) {
      console.error("Error fetching organizer research:", error);
    } finally {
      setIsLoading(false);
    }
  }, [organizerName]);

  useEffect(() => {
    if (organizerName) {
      fetchResearch();
    }
  }, [organizerName, fetchResearch]);

  const generateApproachStrategy = useCallback(async (userTopics: string[]) => {
    if (!data || !organizerName) return;

    setData(prev => prev ? {
      ...prev,
      approachStrategy: { ...prev.approachStrategy, loading: true }
    } : null);

    try {
      const { data: result, error } = await supabase.functions.invoke("generate-organizer-strategy", {
        body: {
          organizerName: data.organizer.name,
          organizationName: data.organizer.organization_name,
          eventHistory: data.eventHistory.slice(0, 5),
          speakersBooked: data.speakersBooked.slice(0, 5),
          insights: data.insights,
          userTopics
        }
      });

      if (error) throw error;

      const strategy = {
        talkingPoints: result.talkingPoints || [],
        suggestedAngle: result.suggestedAngle || "",
        relevantTopics: result.relevantTopics || [],
        loading: false
      };

      setData(prev => prev ? {
        ...prev,
        approachStrategy: strategy
      } : null);

      // Update cache
      const cacheKey = organizerName.toLowerCase().trim();
      if (researchCache.has(cacheKey)) {
        const cached = researchCache.get(cacheKey)!;
        cached.approachStrategy = strategy;
      }
    } catch (error) {
      console.error("Error generating approach strategy:", error);
      setData(prev => prev ? {
        ...prev,
        approachStrategy: { ...prev.approachStrategy, loading: false }
      } : null);
    }
  }, [data, organizerName]);

  const requestDeepResearch = useCallback(async () => {
    if (!organizerName) return;
    
    setData(prev => prev ? { ...prev, isResearchInProgress: true } : null);
    
    // This would trigger a deeper scraping job in a real implementation
    // For now, just simulate the state change
    setTimeout(() => {
      setData(prev => prev ? { ...prev, isResearchInProgress: false } : null);
    }, 3000);
  }, [organizerName]);

  const clearCache = useCallback(() => {
    if (organizerName) {
      researchCache.delete(organizerName.toLowerCase().trim());
    }
  }, [organizerName]);

  return {
    data,
    isLoading,
    fetchResearch,
    generateApproachStrategy,
    requestDeepResearch,
    clearCache
  };
}

function calculateInsights(
  events: EventHistoryItem[], 
  speakers: SpeakerBookedItem[]
): BookingInsights {
  // Calculate budget tier
  const fees = events
    .filter(e => e.fee_estimate_min || e.fee_estimate_max)
    .map(e => ({
      min: e.fee_estimate_min || 0,
      max: e.fee_estimate_max || e.fee_estimate_min || 0
    }));

  let budgetTier = "Unknown";
  let budgetRange = "No fee data available";

  if (fees.length > 0) {
    const avgMin = fees.reduce((sum, f) => sum + f.min, 0) / fees.length;
    const avgMax = fees.reduce((sum, f) => sum + f.max, 0) / fees.length;

    if (avgMax < 3000) {
      budgetTier = "$";
      budgetRange = `Typically under $3,000`;
    } else if (avgMax < 7500) {
      budgetTier = "$$";
      budgetRange = `Typically $${Math.round(avgMin / 1000)}k-$${Math.round(avgMax / 1000)}k`;
    } else if (avgMax < 15000) {
      budgetTier = "$$$";
      budgetRange = `Typically $${Math.round(avgMin / 1000)}k-$${Math.round(avgMax / 1000)}k`;
    } else {
      budgetTier = "$$$$";
      budgetRange = `Premium tier: $${Math.round(avgMin / 1000)}k-$${Math.round(avgMax / 1000)}k+`;
    }
  }

  // Calculate top topics
  const topicCounts = new Map<string, number>();
  events.forEach(e => {
    e.topics.forEach(topic => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
  });
  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Calculate booking timeline
  let avgLeadTime: number | null = null;
  let bookingTimeline = "Unknown booking timeline";

  const eventsWithDates = events.filter(e => e.event_date);
  if (eventsWithDates.length >= 2) {
    // Estimate based on when events are typically announced
    // This is a simplified heuristic
    avgLeadTime = 90; // Default assumption
    bookingTimeline = "Usually books 2-4 months ahead";
  }

  // Determine preferred experience level based on speaker data
  let preferredExperience = "Various experience levels";
  if (speakers.length > 3) {
    preferredExperience = "Experienced with various speakers";
  }

  return {
    budgetTier,
    budgetRange,
    topTopics,
    preferredExperience,
    bookingTimeline,
    totalEvents: events.length,
    avgLeadTime
  };
}
