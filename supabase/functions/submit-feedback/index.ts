import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // 5 submissions per IP per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

interface FeedbackSubmission {
  token: string;
  respondentName: string;
  respondentRole: string;
  overallRating: number;
  contentRating: number;
  deliveryRating: number;
  engagementRating: number;
  wouldRecommend: boolean;
  whatWorkedWell: string;
  whatToImprove: string;
  testimonialQuote?: string;
  canUseAsTestimonial: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    
    // Check rate limit (5 per IP per hour)
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const submission: FeedbackSubmission = await req.json();

    // Find the feedback record by token
    const { data: feedback, error: findError } = await supabase
      .from("event_feedback")
      .select("id, speaker_id, submitted_at")
      .eq("feedback_token", submission.token)
      .single();

    if (findError || !feedback) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired feedback link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (feedback.submitted_at) {
      return new Response(
        JSON.stringify({ error: "Feedback has already been submitted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the feedback record with submission data
    const { error: updateError } = await supabase
      .from("event_feedback")
      .update({
        respondent_name: submission.respondentName,
        respondent_role: submission.respondentRole,
        overall_rating: submission.overallRating,
        content_rating: submission.contentRating,
        delivery_rating: submission.deliveryRating,
        engagement_rating: submission.engagementRating,
        would_recommend: submission.wouldRecommend,
        what_worked_well: submission.whatWorkedWell,
        what_to_improve: submission.whatToImprove,
        testimonial_quote: submission.testimonialQuote,
        can_use_as_testimonial: submission.canUseAsTestimonial,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", feedback.id);

    if (updateError) throw updateError;

    // Update feedback request status
    await supabase
      .from("feedback_requests")
      .update({
        completed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("token", submission.token);

    // Get speaker info for thank you page
    const { data: speaker } = await supabase
      .from("profiles")
      .select("name, linkedin_url, twitter_url, youtube_url")
      .eq("id", feedback.speaker_id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        speaker: speaker || {},
        message: "Thank you for your feedback!" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error submitting feedback:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
