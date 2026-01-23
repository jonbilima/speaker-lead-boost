-- Create confirmed_bookings table
CREATE TABLE public.confirmed_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL,
  match_id UUID,
  event_id UUID,
  event_name TEXT NOT NULL,
  event_date DATE,
  confirmed_fee NUMERIC NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'USD',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'cancelled')),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE,
  expenses NUMERIC DEFAULT 0,
  net_revenue NUMERIC GENERATED ALWAYS AS (confirmed_fee - COALESCE(expenses, 0)) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.confirmed_bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own bookings"
  ON public.confirmed_bookings
  FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own bookings"
  ON public.confirmed_bookings
  FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own bookings"
  ON public.confirmed_bookings
  FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own bookings"
  ON public.confirmed_bookings
  FOR DELETE
  USING (auth.uid() = speaker_id);

-- Add annual revenue goal to profiles
ALTER TABLE public.profiles 
ADD COLUMN annual_revenue_goal NUMERIC DEFAULT 100000,
ADD COLUMN revenue_goal_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Create index for efficient queries
CREATE INDEX idx_confirmed_bookings_speaker_date ON public.confirmed_bookings(speaker_id, event_date);