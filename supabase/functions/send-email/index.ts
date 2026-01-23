import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  replyTo?: string;
  bcc?: string | string[];
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type?: string;
  }>;
  relatedType?: string;
  relatedId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, subject, body, replyTo, bcc, fromName, attachments, relatedType, relatedId }: EmailRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile for email settings
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("name, email_reply_to, email_signature, email_bcc_self")
      .eq("id", user.id)
      .single();

    // Build email body with signature
    let finalBody = body;
    if (profile?.email_signature) {
      finalBody += `\n\n---\n${profile.email_signature}`;
    }

    // Prepare BCC list
    const bccList: string[] = [];
    if (bcc) {
      if (Array.isArray(bcc)) {
        bccList.push(...bcc);
      } else {
        bccList.push(bcc);
      }
    }
    if (profile?.email_bcc_self && user.email) {
      bccList.push(user.email);
    }

    // Determine sender name
    const senderName = fromName || profile?.name || "Speaker";
    
    // Check if using test mode
    const isTestMode = !RESEND_API_KEY || RESEND_API_KEY.startsWith("re_test_");

    // Prepare email payload for Resend API
    const recipients = Array.isArray(to) ? to : [to];
    const emailPayload: any = {
      from: `${senderName} <onboarding@resend.dev>`,
      to: recipients,
      subject,
      html: finalBody.replace(/\n/g, "<br>"),
      reply_to: replyTo || profile?.email_reply_to || user.email,
    };

    if (bccList.length > 0) {
      emailPayload.bcc = bccList;
    }

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        content_type: att.content_type || "application/octet-stream",
      }));
    }

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    // Log email to database
    const bodyPreview = body.substring(0, 100) + (body.length > 100 ? "..." : "");
    const recipientEmails = recipients.join(", ");

    await supabaseClient.from("email_logs").insert({
      speaker_id: user.id,
      recipient_email: recipientEmails,
      subject,
      body_preview: bodyPreview,
      status: resendResponse.ok ? "sent" : "failed",
      sent_at: resendResponse.ok ? new Date().toISOString() : null,
      error_message: resendResponse.ok ? null : (resendData.message || "Unknown error"),
      related_type: relatedType || null,
      related_id: relatedId || null,
      resend_id: resendData.id || null,
    });

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: resendData.message || "Failed to send email",
          testMode: isTestMode 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: resendData.id,
        testMode: isTestMode 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);