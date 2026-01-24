import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackRequestPayload {
  bookingId: string;
  recipientEmail: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  speakerName: string;
  customMessage?: string;
  isReminder?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const payload: FeedbackRequestPayload = await req.json();
    const { bookingId, recipientEmail, recipientName, eventName, eventDate, speakerName, customMessage, isReminder } = payload;

    // Generate unique token
    const token = crypto.randomUUID();
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") || "https://speaker-lead-boost.lovable.app";
    const feedbackUrl = `${baseUrl}/feedback/${token}`;

    // Create feedback request record
    if (!isReminder) {
      const { error: requestError } = await supabase
        .from("feedback_requests")
        .insert({
          speaker_id: user.id,
          booking_id: bookingId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          token,
          sent_at: new Date().toISOString(),
          status: "sent",
        });

      if (requestError) throw requestError;

      // Create event_feedback record with token
      const { error: feedbackError } = await supabase
        .from("event_feedback")
        .insert({
          speaker_id: user.id,
          booking_id: bookingId,
          event_name: eventName,
          event_date: eventDate,
          feedback_token: token,
          respondent_email: recipientEmail,
          respondent_name: recipientName,
        });

      if (feedbackError) throw feedbackError;
    } else {
      // Update reminder sent timestamp
      await supabase
        .from("feedback_requests")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("booking_id", bookingId)
        .eq("recipient_email", recipientEmail);
    }

    // Send email
    const subject = isReminder 
      ? `Reminder: How was ${speakerName}'s presentation at ${eventName}?`
      : `Quick feedback request: ${eventName}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📝 Quick Feedback Request</h1>
            </div>
            
            <p>Hi ${recipientName || "there"},</p>
            
            ${customMessage ? `<p>${customMessage}</p>` : `
              <p>Thank you for having ${speakerName} speak at <strong>${eventName}</strong>${eventDate ? ` on ${new Date(eventDate).toLocaleDateString()}` : ""}.</p>
              <p>Your feedback helps speakers improve and serve future audiences better. It only takes 2 minutes!</p>
            `}
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${feedbackUrl}" class="button">Share Your Feedback</a>
            </p>
            
            <div class="footer">
              <p>This feedback is confidential and helps improve future presentations.</p>
              <p>If you have any questions, simply reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email_reply_to")
      .eq("id", user.id)
      .single();

    const emailResponse = await resend.emails.send({
      from: "NextMic <feedback@resend.dev>",
      to: [recipientEmail],
      reply_to: profile?.email_reply_to || user.email,
      subject,
      html: emailHtml,
    });

    console.log("Feedback request email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending feedback request:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
