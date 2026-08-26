import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPPORT_INBOX = "support@nextmic.ai";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 50) : "general";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : "";

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Subject and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `
      <h2>New support request</h2>
      <p><strong>Category:</strong> ${escape(category)}</p>
      <p><strong>From:</strong> ${escape(user.email ?? "unknown")} (user ${user.id})</p>
      ${pageUrl ? `<p><strong>Page:</strong> ${escape(pageUrl)}</p>` : ""}
      <hr />
      <p>${escape(message).replace(/\n/g, "<br>")}</p>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NextMic Support <gigs@nextmic.ai>",
        to: [SUPPORT_INBOX],
        reply_to: user.email ?? undefined,
        subject: `[Support] ${subject}`,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    // Best-effort log; ignore failures so support never silently breaks.
    await supabase.from("email_logs").insert({
      speaker_id: user.id,
      recipient_email: SUPPORT_INBOX,
      subject: `[Support] ${subject}`,
      body_preview: message.slice(0, 100),
      status: resendRes.ok ? "sent" : "failed",
      sent_at: resendRes.ok ? new Date().toISOString() : null,
      error_message: resendRes.ok ? null : (resendData?.message ?? "Unknown error"),
      related_type: "support_request",
      resend_id: resendData?.id ?? null,
    });

    if (!resendRes.ok) {
      console.error("Resend error", resendData);
      return new Response(JSON.stringify({ error: resendData?.message || "Failed to send support request" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-support-request error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
