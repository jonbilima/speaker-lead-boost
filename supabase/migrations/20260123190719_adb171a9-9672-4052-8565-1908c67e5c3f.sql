-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('pitch', 'follow_up', 'thank_you', 'custom')),
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'::TEXT[],
  is_default BOOLEAN DEFAULT false,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own templates"
  ON public.email_templates FOR SELECT
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can insert their own templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

CREATE POLICY "Users can update their own templates"
  ON public.email_templates FOR UPDATE
  USING (auth.uid() = speaker_id);

CREATE POLICY "Users can delete their own templates"
  ON public.email_templates FOR DELETE
  USING (auth.uid() = speaker_id);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default templates for new users
CREATE OR REPLACE FUNCTION public.seed_default_templates()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.email_templates (speaker_id, name, category, subject_template, body_template, variables, is_default)
  VALUES
    (NEW.id, 'Cold Pitch - Conference', 'pitch', 
     'Speaking Opportunity for {event_name}',
     'Dear {organizer_name},

I came across {event_name} and was impressed by the focus on {speaker_topic}. As a speaker who specializes in this area, I believe I could add significant value to your attendees.

My name is {speaker_name}, and I have helped audiences at organizations like [notable clients] understand and apply these concepts effectively.

I''d love to discuss how my session could complement your event lineup. Would you be open to a brief call next week?

Best regards,
{speaker_name}',
     ARRAY['event_name', 'organizer_name', 'speaker_topic', 'speaker_name'], true),
    
    (NEW.id, 'Cold Pitch - Corporate', 'pitch',
     'Keynote Speaker Inquiry - {organization}',
     'Dear {organizer_name},

I understand {organization} is planning upcoming events, and I wanted to reach out about potential speaking opportunities.

I specialize in {speaker_topic} and have delivered keynotes for corporate audiences ranging from leadership teams to full company gatherings. My sessions focus on practical takeaways that attendees can apply immediately.

My typical fee range is {fee_range}, and I''m flexible on format - from 45-minute keynotes to half-day workshops.

Would you be the right person to discuss this with, or could you point me in the right direction?

Best,
{speaker_name}',
     ARRAY['organizer_name', 'organization', 'speaker_topic', 'fee_range', 'speaker_name'], true),
    
    (NEW.id, 'Warm Introduction Request', 'pitch',
     'Quick favor - introduction to {organizer_name}?',
     'Hi [Connection Name],

I hope you''re doing well! I noticed you''re connected with {organizer_name} at {organization} on LinkedIn.

I''m looking to speak at {event_name} and think my expertise in {speaker_topic} would be a great fit for their audience. Would you be comfortable making a brief introduction?

I''d be happy to draft a short blurb you could forward, making it as easy as possible for you.

Thanks so much for considering!

{speaker_name}',
     ARRAY['organizer_name', 'organization', 'event_name', 'speaker_topic', 'speaker_name'], true),
    
    (NEW.id, 'Follow-up #1', 'follow_up',
     'Following up - {event_name} speaking opportunity',
     'Hi {organizer_name},

I wanted to follow up on my earlier note about speaking at {event_name}. I know event planning is incredibly busy, so I wanted to make sure my message didn''t get lost.

I remain very interested in contributing to your program with a session on {speaker_topic}. I''d be happy to send over a one-sheet or video reel if that would be helpful.

Looking forward to hearing from you when timing allows.

Best,
{speaker_name}',
     ARRAY['organizer_name', 'event_name', 'speaker_topic', 'speaker_name'], true),
    
    (NEW.id, 'Follow-up #2', 'follow_up',
     'Thought you might find this useful - {event_name}',
     'Hi {organizer_name},

I wanted to share a quick resource that might be valuable as you plan {event_name}.

[Link to relevant article/video/insight]

This connects to what I typically speak about regarding {speaker_topic}. I thought your attendees might benefit from similar insights.

I''m still very interested in contributing to your event lineup. Happy to chat whenever works for you.

Best,
{speaker_name}',
     ARRAY['organizer_name', 'event_name', 'speaker_topic', 'speaker_name'], true),
    
    (NEW.id, 'Thank You - After Booking', 'thank_you',
     'Thank you - excited for {event_name}!',
     'Dear {organizer_name},

Thank you so much for confirming my speaking slot at {event_name} on {event_date}! I''m truly honored to be part of your program.

To confirm the details:
- Event: {event_name}
- Date: {event_date}
- Topic: {speaker_topic}

I''ll begin preparing my content and will reach out closer to the date to coordinate any logistics.

Please don''t hesitate to reach out if you need anything from me in the meantime - bio, headshot, session description, or any other materials.

Looking forward to delivering an impactful session for your audience!

Warm regards,
{speaker_name}',
     ARRAY['organizer_name', 'event_name', 'event_date', 'speaker_topic', 'speaker_name'], true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to seed templates on new profile creation
CREATE TRIGGER seed_templates_for_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_templates();