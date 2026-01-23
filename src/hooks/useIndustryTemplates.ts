import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IndustryTemplate {
  name: string;
  category: string;
  industry: string;
  subject_template: string;
  body_template: string;
  ps_line: string;
  best_practice: string;
  variables: string[];
}

const industryTemplates: IndustryTemplate[] = [
  // EDUCATION
  {
    name: "Education - Cold Pitch",
    category: "cold_pitch",
    industry: "education",
    subject_template: "Keynote Speaker for {event_name} - Inspiring Your Educators",
    body_template: `Dear {organizer_name},

I'm reaching out about speaking opportunities at {event_name}. As a speaker who specializes in {speaker_topic}, I've had the privilege of addressing educators at conferences and professional development days across the country.

Teachers and administrators face unique challenges, and my sessions focus on practical strategies they can implement immediately. Recent clients include [School District/University names].

I'd love to discuss how my presentation could energize your educators and provide real value to your attendees.

Best regards,
{speaker_name}`,
    ps_line: "P.S. I'm happy to customize my session for your specific audience - whether K-12, Higher Ed, or administration-focused.",
    best_practice: "Reference specific educational challenges like teacher burnout, student engagement, or technology integration.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Education - Follow-up #1",
    category: "follow_up_1",
    industry: "education",
    subject_template: "Following up - {event_name} speaker opportunity",
    body_template: `Hi {organizer_name},

I wanted to follow up on my earlier message about speaking at {event_name}. I know the academic calendar keeps everyone incredibly busy!

I've been reflecting on how {speaker_topic} could specifically benefit your educators. Would a 15-minute call work to explore if there's a fit?

Looking forward to connecting,
{speaker_name}`,
    ps_line: "P.S. I recently shared a short article on [relevant topic] that might resonate with your audience - happy to send it along.",
    best_practice: "Acknowledge the busy academic schedule and offer flexibility.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Education - Thank You",
    category: "thank_you",
    industry: "education",
    subject_template: "Thank you for the opportunity at {event_name}!",
    body_template: `Dear {organizer_name},

Thank you so much for having me speak at {event_name}! It was an honor to connect with such dedicated educators.

The energy in the room was incredible, and I appreciated the thoughtful questions from the audience. I hope the strategies I shared will serve them well in their classrooms.

Please don't hesitate to reach out if I can support any future events or if you'd like follow-up resources for attendees.

With gratitude,
{speaker_name}`,
    ps_line: "P.S. I'd be grateful for any testimonial or feedback you could share - it helps me continue improving.",
    best_practice: "Offer follow-up resources and express genuine appreciation for educators' work.",
    variables: ["event_name", "organizer_name", "speaker_name"],
  },

  // FAITH-BASED
  {
    name: "Faith-Based - Cold Pitch",
    category: "cold_pitch",
    industry: "faith_based",
    subject_template: "Speaker Inquiry - Uplifting Your Congregation at {event_name}",
    body_template: `Dear {organizer_name},

I hope this message finds you well. I'm reaching out because I believe my speaking ministry on {speaker_topic} could bless your congregation at {event_name}.

My approach combines biblical foundations with practical application, helping attendees deepen their faith while navigating real-world challenges. I've been honored to speak at churches and ministry events including [examples].

I would be grateful for the opportunity to discuss how I might serve your community.

In His service,
{speaker_name}`,
    ps_line: "P.S. I'm flexible on honorarium and can work within your budget to make this happen.",
    best_practice: "Lead with service-oriented language and express flexibility on compensation.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Faith-Based - Follow-up #1",
    category: "follow_up_1",
    industry: "faith_based",
    subject_template: "Circling back - {event_name} speaking opportunity",
    body_template: `Dear {organizer_name},

I wanted to gently follow up on my previous message about speaking at {event_name}. I understand ministry work keeps you incredibly busy, and I appreciate your time.

I remain prayerfully interested in serving your congregation through a message on {speaker_topic}. Would you have a few minutes to chat about your vision for the event?

Blessings,
{speaker_name}`,
    ps_line: "P.S. I'm happy to provide references from other ministry leaders who can speak to my approach.",
    best_practice: "Use gentle, service-oriented language and offer references from other faith leaders.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Faith-Based - Feedback Request",
    category: "feedback_request",
    industry: "faith_based",
    subject_template: "Would love your thoughts on the {event_name} session",
    body_template: `Dear {organizer_name},

I wanted to reach out to thank you again for the opportunity to speak at {event_name}. It was such a blessing to connect with your congregation.

If you have a moment, I would be so grateful for any feedback you could share. Your insights help me better serve future audiences and continue growing in this ministry.

Even a brief testimonial would mean the world to me.

With gratitude and blessings,
{speaker_name}`,
    ps_line: "P.S. Please keep me in mind for future events - I'd love to continue serving your community.",
    best_practice: "Express gratitude authentically and frame feedback as helping your ministry.",
    variables: ["event_name", "organizer_name", "speaker_name"],
  },

  // CORPORATE
  {
    name: "Corporate - Cold Pitch",
    category: "cold_pitch",
    industry: "corporate",
    subject_template: "Keynote Speaker for {organization} - Driving Results Through {speaker_topic}",
    body_template: `Dear {organizer_name},

I'm reaching out regarding speaking opportunities at {organization}. I specialize in {speaker_topic} and have delivered keynotes for Fortune 500 companies and high-growth organizations.

My sessions are designed to be engaging, actionable, and directly tied to business outcomes. Recent clients include [Company names] where I've helped teams [specific outcome].

My typical engagement fee ranges from {fee_range}, and I'm flexible on format - from 45-minute keynotes to full-day workshops.

Would you be open to a brief conversation about your upcoming events?

Best regards,
{speaker_name}`,
    ps_line: "P.S. I'm happy to customize content specifically for your industry and team challenges.",
    best_practice: "Lead with business outcomes and ROI. Be upfront about fees and flexibility.",
    variables: ["organization", "organizer_name", "speaker_topic", "fee_range", "speaker_name"],
  },
  {
    name: "Corporate - Follow-up #1",
    category: "follow_up_1",
    industry: "corporate",
    subject_template: "Following up - {organization} keynote opportunity",
    body_template: `Hi {organizer_name},

I wanted to follow up on my previous note about speaking at {organization}. I know Q[X] planning gets hectic!

I've been thinking about how {speaker_topic} specifically applies to your industry. Would you have 15 minutes this week to explore if there's a fit?

Best,
{speaker_name}`,
    ps_line: "P.S. I recently published a piece on [relevant topic] in [publication] - happy to share if useful.",
    best_practice: "Keep it brief and professional. Offer a specific time frame for a call.",
    variables: ["organization", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Corporate - Thank You",
    category: "thank_you",
    industry: "corporate",
    subject_template: "Thank you - {event_name} was exceptional",
    body_template: `Dear {organizer_name},

Thank you for having me keynote at {event_name}. It was a pleasure to work with your team and engage with such a dynamic audience.

I hope the session on {speaker_topic} provided actionable insights your team can implement right away. I'd welcome any feedback you'd like to share.

Please keep me in mind for future events - I'd love to continue the partnership.

Best regards,
{speaker_name}`,
    ps_line: "P.S. I'll be sending a brief follow-up with the key resources I mentioned during the session.",
    best_practice: "Offer post-event value and position for future engagements.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },

  // NONPROFIT
  {
    name: "Nonprofit - Cold Pitch",
    category: "cold_pitch",
    industry: "nonprofit",
    subject_template: "Speaker for {event_name} - Amplifying Your Impact",
    body_template: `Dear {organizer_name},

I'm inspired by the work {organization} does, and I would be honored to contribute as a speaker at {event_name}.

I specialize in {speaker_topic} and have spoken at numerous nonprofit conferences and fundraising events. My approach focuses on inspiring action while providing practical tools your stakeholders can use.

I understand nonprofit budgets are often tight, and I'm flexible with my speaker fee to support your mission.

Would you be open to discussing how I might add value to your event?

Warm regards,
{speaker_name}`,
    ps_line: "P.S. I'm happy to promote your event to my network before and after as well.",
    best_practice: "Show genuine connection to their mission and lead with flexibility on fees.",
    variables: ["event_name", "organization", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Nonprofit - Follow-up #1",
    category: "follow_up_1",
    industry: "nonprofit",
    subject_template: "Following up - {event_name} speaker opportunity",
    body_template: `Hi {organizer_name},

I wanted to follow up on my earlier message about speaking at {event_name}. I continue to be inspired by {organization}'s mission.

Would you have a few minutes to chat about your event goals? I'd love to understand how I might best support your attendees.

Best,
{speaker_name}`,
    ps_line: "P.S. I'm also happy to donate a portion of my fee back to the organization if that helps.",
    best_practice: "Emphasize mission alignment and offer creative fee arrangements.",
    variables: ["event_name", "organization", "organizer_name", "speaker_name"],
  },
  {
    name: "Nonprofit - Feedback Request",
    category: "feedback_request",
    industry: "nonprofit",
    subject_template: "Your feedback on {event_name}?",
    body_template: `Dear {organizer_name},

Thank you again for the wonderful experience at {event_name}. It was an honor to support {organization}'s important work.

As I continue to refine my speaking, your feedback would be invaluable. If you have a moment to share your thoughts or a brief testimonial, I would be deeply grateful.

With appreciation,
{speaker_name}`,
    ps_line: "P.S. I'd love to stay connected and support future events in any way I can.",
    best_practice: "Express genuine appreciation for their mission work.",
    variables: ["event_name", "organization", "organizer_name", "speaker_name"],
  },

  // Additional templates for warm pitch and follow-up sequences
  {
    name: "Universal - Warm Pitch",
    category: "warm_pitch",
    industry: "all",
    subject_template: "Great connecting at {event_name} - speaking opportunity",
    body_template: `Hi {organizer_name},

It was wonderful meeting you at {event_name}! I really enjoyed our conversation about {topic_discussed}.

As we discussed, I specialize in {speaker_topic} and would love to explore speaking opportunities with your organization. Based on what you shared, I think there could be great alignment.

Would you have time for a quick call this week to discuss further?

Best,
{speaker_name}`,
    ps_line: "P.S. I'll send over my speaker kit so you can share it with your team.",
    best_practice: "Reference the specific connection point and any topics you discussed.",
    variables: ["event_name", "organizer_name", "topic_discussed", "speaker_topic", "speaker_name"],
  },
  {
    name: "Universal - Follow-up #2",
    category: "follow_up_2",
    industry: "all",
    subject_template: "Thought this might be valuable - {event_name}",
    body_template: `Hi {organizer_name},

I wanted to share a quick resource that I thought might be relevant as you plan {event_name}: [Link to article/video].

This connects to what I typically present on {speaker_topic}. I've found audiences really resonate with this approach.

I remain very interested in contributing to your event. Happy to chat whenever works for you.

Best,
{speaker_name}`,
    ps_line: "P.S. No pressure at all - just wanted to stay on your radar and provide some value.",
    best_practice: "Lead with value by sharing relevant, helpful content.",
    variables: ["event_name", "organizer_name", "speaker_topic", "speaker_name"],
  },
  {
    name: "Universal - Follow-up #3 (Final)",
    category: "follow_up_3",
    industry: "all",
    subject_template: "Last note - {event_name} speaking",
    body_template: `Hi {organizer_name},

I know you're busy, so I'll keep this brief. I wanted to send one last note about the speaking opportunity at {event_name}.

If the timing isn't right or you've gone in another direction, no worries at all! I'd still love to stay connected for future opportunities.

Either way, I wish you a fantastic event!

Best,
{speaker_name}`,
    ps_line: "P.S. Feel free to reach out anytime - my calendar is always open for a conversation.",
    best_practice: "Keep it gracious and leave the door open without pressure.",
    variables: ["event_name", "organizer_name", "speaker_name"],
  },
];

export function useIndustryTemplates() {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const seedTemplatesIfNeeded = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if user has industry templates (look for one with industry tag)
        const { data: existingTemplates, error: checkError } = await supabase
          .from("email_templates")
          .select("name")
          .eq("speaker_id", session.user.id)
          .ilike("name", "%Education%")
          .limit(1);

        if (checkError) throw checkError;

        // If user already has industry templates, don't seed
        if (existingTemplates && existingTemplates.length > 0) {
          setSeeded(true);
          return;
        }

        setSeeding(true);

        // Map industry templates to database format
        const templatesWithUserId = industryTemplates.map((t) => ({
          speaker_id: session.user.id,
          name: t.name,
          category: t.category.includes("cold") || t.category.includes("warm") ? "pitch" :
                    t.category.includes("follow") ? "follow_up" :
                    t.category.includes("thank") ? "thank_you" : "custom",
          subject_template: t.subject_template,
          body_template: `${t.body_template}\n\n${t.ps_line}\n\n---\n💡 Best Practice: ${t.best_practice}`,
          variables: t.variables,
          is_default: false,
        }));

        const { error: insertError } = await supabase
          .from("email_templates")
          .insert(templatesWithUserId);

        if (insertError) throw insertError;

        setSeeded(true);
      } catch (error) {
        console.error("Failed to seed industry templates:", error);
      } finally {
        setSeeding(false);
      }
    };

    seedTemplatesIfNeeded();
  }, []);

  return { seeding, seeded, templates: industryTemplates };
}

export const templateCategories = [
  { id: "cold_pitch", label: "Cold Pitch" },
  { id: "warm_pitch", label: "Warm Pitch" },
  { id: "follow_up_1", label: "Follow-up #1" },
  { id: "follow_up_2", label: "Follow-up #2" },
  { id: "follow_up_3", label: "Follow-up #3 (Final)" },
  { id: "thank_you", label: "Thank You" },
  { id: "feedback_request", label: "Feedback Request" },
];

export const templateIndustries = [
  { id: "all", label: "All Industries" },
  { id: "education", label: "Education (K-12, Higher Ed)" },
  { id: "faith_based", label: "Faith-Based (Churches, Ministries)" },
  { id: "corporate", label: "Corporate (Enterprise, Mid-Market)" },
  { id: "nonprofit", label: "Nonprofit (Foundations, NGOs)" },
  { id: "healthcare", label: "Healthcare" },
  { id: "government", label: "Government" },
  { id: "small_business", label: "Small Business (Chambers, Associations)" },
];
