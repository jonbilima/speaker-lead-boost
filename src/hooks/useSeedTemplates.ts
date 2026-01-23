import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const defaultTemplates = [
  {
    name: 'Cold Pitch - Conference',
    category: 'pitch',
    subject_template: 'Speaking Opportunity for {event_name}',
    body_template: `Dear {organizer_name},

I came across {event_name} and was impressed by the focus on {speaker_topic}. As a speaker who specializes in this area, I believe I could add significant value to your attendees.

My name is {speaker_name}, and I have helped audiences at organizations like [notable clients] understand and apply these concepts effectively.

I'd love to discuss how my session could complement your event lineup. Would you be open to a brief call next week?

Best regards,
{speaker_name}`,
    variables: ['event_name', 'organizer_name', 'speaker_topic', 'speaker_name'],
  },
  {
    name: 'Cold Pitch - Corporate',
    category: 'pitch',
    subject_template: 'Keynote Speaker Inquiry - {organization}',
    body_template: `Dear {organizer_name},

I understand {organization} is planning upcoming events, and I wanted to reach out about potential speaking opportunities.

I specialize in {speaker_topic} and have delivered keynotes for corporate audiences ranging from leadership teams to full company gatherings. My sessions focus on practical takeaways that attendees can apply immediately.

My typical fee range is {fee_range}, and I'm flexible on format - from 45-minute keynotes to half-day workshops.

Would you be the right person to discuss this with, or could you point me in the right direction?

Best,
{speaker_name}`,
    variables: ['organizer_name', 'organization', 'speaker_topic', 'fee_range', 'speaker_name'],
  },
  {
    name: 'Warm Introduction Request',
    category: 'pitch',
    subject_template: 'Quick favor - introduction to {organizer_name}?',
    body_template: `Hi [Connection Name],

I hope you're doing well! I noticed you're connected with {organizer_name} at {organization} on LinkedIn.

I'm looking to speak at {event_name} and think my expertise in {speaker_topic} would be a great fit for their audience. Would you be comfortable making a brief introduction?

I'd be happy to draft a short blurb you could forward, making it as easy as possible for you.

Thanks so much for considering!

{speaker_name}`,
    variables: ['organizer_name', 'organization', 'event_name', 'speaker_topic', 'speaker_name'],
  },
  {
    name: 'Follow-up #1',
    category: 'follow_up',
    subject_template: 'Following up - {event_name} speaking opportunity',
    body_template: `Hi {organizer_name},

I wanted to follow up on my earlier note about speaking at {event_name}. I know event planning is incredibly busy, so I wanted to make sure my message didn't get lost.

I remain very interested in contributing to your program with a session on {speaker_topic}. I'd be happy to send over a one-sheet or video reel if that would be helpful.

Looking forward to hearing from you when timing allows.

Best,
{speaker_name}`,
    variables: ['organizer_name', 'event_name', 'speaker_topic', 'speaker_name'],
  },
  {
    name: 'Follow-up #2',
    category: 'follow_up',
    subject_template: 'Thought you might find this useful - {event_name}',
    body_template: `Hi {organizer_name},

I wanted to share a quick resource that might be valuable as you plan {event_name}.

[Link to relevant article/video/insight]

This connects to what I typically speak about regarding {speaker_topic}. I thought your attendees might benefit from similar insights.

I'm still very interested in contributing to your event lineup. Happy to chat whenever works for you.

Best,
{speaker_name}`,
    variables: ['organizer_name', 'event_name', 'speaker_topic', 'speaker_name'],
  },
  {
    name: 'Thank You - After Booking',
    category: 'thank_you',
    subject_template: 'Thank you - excited for {event_name}!',
    body_template: `Dear {organizer_name},

Thank you so much for confirming my speaking slot at {event_name} on {event_date}! I'm truly honored to be part of your program.

To confirm the details:
- Event: {event_name}
- Date: {event_date}
- Topic: {speaker_topic}

I'll begin preparing my content and will reach out closer to the date to coordinate any logistics.

Please don't hesitate to reach out if you need anything from me in the meantime - bio, headshot, session description, or any other materials.

Looking forward to delivering an impactful session for your audience!

Warm regards,
{speaker_name}`,
    variables: ['organizer_name', 'event_name', 'event_date', 'speaker_topic', 'speaker_name'],
  },
];

export function useSeedTemplates() {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const seedTemplatesIfNeeded = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if user already has templates
        const { data: existingTemplates, error: checkError } = await supabase
          .from('email_templates')
          .select('id')
          .eq('speaker_id', session.user.id)
          .limit(1);

        if (checkError) throw checkError;

        // If user already has templates, don't seed
        if (existingTemplates && existingTemplates.length > 0) {
          setSeeded(true);
          return;
        }

        setSeeding(true);

        // Seed default templates
        const templatesWithUserId = defaultTemplates.map(t => ({
          ...t,
          speaker_id: session.user.id,
          is_default: true,
        }));

        const { error: insertError } = await supabase
          .from('email_templates')
          .insert(templatesWithUserId);

        if (insertError) throw insertError;

        setSeeded(true);
      } catch (error) {
        console.error('Failed to seed templates:', error);
      } finally {
        setSeeding(false);
      }
    };

    seedTemplatesIfNeeded();
  }, []);

  return { seeding, seeded };
}
