export interface Testimonial {
  id: string;
  speaker_id: string;
  quote: string;
  author_name: string;
  author_title: string | null;
  author_company: string | null;
  author_email: string | null;
  author_photo_url: string | null;
  event_name: string | null;
  event_date: string | null;
  rating: number | null;
  is_featured: boolean;
  source: 'manual' | 'requested' | 'imported';
  request_token: string | null;
  request_sent_at: string | null;
  request_opened_at: string | null;
  received_at: string | null;
  created_at: string;
}
