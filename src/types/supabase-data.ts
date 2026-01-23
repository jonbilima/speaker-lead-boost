// Type definitions for Supabase query responses to eliminate 'any' types

export interface OpportunityWithTopics {
  opportunity_id: string;
  topics: {
    name: string;
  } | null;
}

export interface OpportunityScoreWithOpportunity {
  id: string;
  ai_score: number | null;
  ai_reason: string | null;
  pipeline_stage: string | null;
  calculated_at: string;
  opportunity_id: string;
  opportunities: {
    id: string;
    event_name: string;
    organizer_name: string | null;
    organizer_email?: string | null;
    description: string | null;
    deadline: string | null;
    event_date: string | null;
    location: string | null;
    fee_estimate_min: number | null;
    fee_estimate_max: number | null;
    audience_size?: number | null;
    event_url: string | null;
  } | null;
}

export interface PackageViewWithPackage {
  id: string;
  timestamp: string;
  event_type: string;
  application_packages: {
    package_title: string;
    tracking_code: string;
    speaker_id: string;
  } | null;
}

export interface InboundLeadRow {
  id: string;
  name: string;
  company: string | null;
  created_at: string;
}

export interface OutreachActivityRow {
  id: string;
  activity_type: string;
  subject: string | null;
  created_at: string;
  email_opened_at: string | null;
}

export interface UserTopicWithTopic {
  topic_id: string;
  topics: {
    name: string;
  } | null;
}

export interface OpportunityScoreRow {
  pipeline_stage: string | null;
}

export interface ConversationRow {
  id: string;
  title: string;
  mode: string | null;
  messages: unknown;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// Recharts tooltip props type
export interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

// Profile type for Coach page
export interface SpeakerProfile {
  id: string;
  name: string | null;
  bio: string | null;
  headline: string | null;
  fee_range_min: number | null;
  fee_range_max: number | null;
  industries: string[] | null;
  audience_types: string[] | null;
  location_city: string | null;
  location_country: string | null;
}

// User type from Supabase auth
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}
