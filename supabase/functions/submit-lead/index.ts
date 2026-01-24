import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // requests per window
const RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in ms (stricter than hourly)

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

// Validation helpers
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 255;

function validateEmail(email: string): boolean {
  return emailRegex.test(email) && email.length <= MAX_FIELD_LENGTH;
}

function sanitizeString(str: string | null, maxLength: number): string | null {
  if (!str) return null;
  // Remove potential HTML/script tags
  const sanitized = str.replace(/<[^>]*>/g, "").trim();
  return sanitized.slice(0, maxLength) || null;
}

function validateDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return null;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  // Must be in the future
  if (date < new Date()) return null;
  
  return dateStr;
}

// Simple spam detection
function isSpammy(message: string | null, name: string): boolean {
  if (!message) return false;
  
  const spamPatterns = [
    /\b(viagra|cialis|casino|lottery|winner|click here|buy now)\b/i,
    /\[url=/i,
    /http[s]?:\/\/[^\s]*http[s]?:\/\//i, // Multiple URLs
    /<script/i,
  ];
  
  const combined = `${name} ${message}`;
  return spamPatterns.some(pattern => pattern.test(combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    
    // Check rate limit
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Validate required fields
    const { speaker_id, name, email, company, event_name, event_type, event_date, estimated_audience, budget_range, message } = body;

    if (!speaker_id || typeof speaker_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid speaker" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || typeof email !== "string" || !validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name, MAX_NAME_LENGTH);
    const sanitizedCompany = sanitizeString(company, MAX_FIELD_LENGTH);
    const sanitizedEventName = sanitizeString(event_name, MAX_FIELD_LENGTH);
    const sanitizedEventType = sanitizeString(event_type, MAX_FIELD_LENGTH);
    const sanitizedAudience = sanitizeString(estimated_audience, MAX_FIELD_LENGTH);
    const sanitizedBudget = sanitizeString(budget_range, MAX_FIELD_LENGTH);
    const sanitizedMessage = sanitizeString(message, MAX_MESSAGE_LENGTH);
    const validatedDate = validateDate(event_date);

    // Check for spam
    if (isSpammy(sanitizedMessage, sanitizedName || "")) {
      // Silently reject spam (don't give spammers feedback)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to insert
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify speaker exists
    const { data: speaker, error: speakerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", speaker_id)
      .eq("is_public", true)
      .single();

    if (speakerError || !speaker) {
      return new Response(
        JSON.stringify({ error: "Speaker not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert lead
    const { error: insertError } = await supabase.from("inbound_leads").insert({
      speaker_id,
      name: sanitizedName,
      email: email.toLowerCase().trim(),
      company: sanitizedCompany,
      event_name: sanitizedEventName,
      event_type: sanitizedEventType,
      event_date: validatedDate,
      estimated_audience: sanitizedAudience,
      budget_range: sanitizedBudget,
      message: sanitizedMessage,
      source: "widget",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit inquiry" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-lead:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
