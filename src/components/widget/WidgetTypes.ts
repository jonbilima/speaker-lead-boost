export interface InboundLead {
  id: string;
  speaker_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  event_name?: string;
  event_date?: string;
  event_type?: string;
  estimated_audience?: string;
  budget_range?: string;
  message?: string;
  source: 'widget' | 'profile' | 'referral';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'closed';
  notes?: string;
  created_at: string;
}

export interface WidgetSettings {
  primary_color: string;
  show_photo: boolean;
  show_topics: boolean;
  show_availability: boolean;
}

export interface SpeakerWidgetData {
  id: string;
  name: string;
  headline?: string;
  bio?: string;
  slug?: string;
  widget_settings?: WidgetSettings;
}

export const EVENT_TYPES = [
  'Conference Keynote',
  'Corporate Event',
  'Workshop/Training',
  'Webinar',
  'Panel Discussion',
  'Podcast',
  'Association Meeting',
  'University Lecture',
  'Other',
];

export const BUDGET_RANGES = [
  'Under $2,500',
  '$2,500 - $5,000',
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000+',
  'Not sure yet',
];

export const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
  { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-700' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-700' },
];
