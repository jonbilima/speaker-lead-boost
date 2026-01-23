export interface WatchedSpeaker {
  id: string;
  speaker_id: string;
  watched_name: string;
  watched_linkedin_url: string | null;
  watched_website: string | null;
  watched_topics: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WatchedSpeakerBooking {
  id: string;
  watched_speaker_id: string;
  event_name: string;
  organization_name: string | null;
  event_date: string | null;
  source_url: string | null;
  discovered_at: string;
  watched_speakers?: WatchedSpeaker;
}

export interface OverlapAlert {
  watchedSpeakerName: string;
  eventName: string;
  userAppliedDate: string;
  discoveredAt: string;
}
