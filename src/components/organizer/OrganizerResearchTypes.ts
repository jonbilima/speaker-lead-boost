export interface OrganizerData {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  organization_name: string | null;
  organization_website: string | null;
}

export interface EventHistoryItem {
  id: string;
  event_name: string;
  event_date: string | null;
  location: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  topics: string[];
}

export interface SpeakerBookedItem {
  id: string;
  speaker_name: string;
  speaker_linkedin: string | null;
  event_name: string;
  event_date: string | null;
}

export interface BookingInsights {
  budgetTier: string;
  budgetRange: string;
  topTopics: { name: string; count: number }[];
  preferredExperience: string;
  bookingTimeline: string;
  totalEvents: number;
  avgLeadTime: number | null;
}

export interface ApproachStrategy {
  talkingPoints: string[];
  suggestedAngle: string;
  relevantTopics: string[];
  loading: boolean;
}

export interface OrganizerResearchData {
  organizer: OrganizerData;
  eventHistory: EventHistoryItem[];
  speakersBooked: SpeakerBookedItem[];
  insights: BookingInsights;
  approachStrategy: ApproachStrategy;
  isLoading: boolean;
  isResearchInProgress: boolean;
  hasLimitedData: boolean;
}
