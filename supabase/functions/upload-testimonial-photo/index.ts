import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;

    if (!file || !token) {
      return new Response(
        JSON.stringify({ error: "Missing file or token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 5MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the request token - verify it exists and hasn't been submitted yet
    const { data: testimonial, error: tokenError } = await supabase
      .from("testimonials")
      .select("id, speaker_id, quote")
      .eq("request_token", token)
      .single();

    if (tokenError || !testimonial) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if testimonial already submitted
    if (testimonial.quote && testimonial.quote.trim() !== "") {
      return new Response(
        JSON.stringify({ error: "Testimonial already submitted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure file path in testimonials folder
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const sanitizedExt = ["jpg", "jpeg", "png", "webp"].includes(fileExt) ? fileExt : "jpg";
    const fileName = `testimonials/${testimonial.speaker_id}/${testimonial.id}-${Date.now()}.${sanitizedExt}`;

    // Read file as array buffer
    const fileBuffer = await file.arrayBuffer();

    // Upload using service role (bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from("speaker-assets")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("speaker-assets")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ url: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in upload-testimonial-photo:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
