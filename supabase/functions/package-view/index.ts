// package-view: everything an organizer's package page needs, for one package.
//
// The page is opened by an organizer who isn't signed in, so it used to read
// application_packages, profiles, speaker_assets and opportunities straight
// from the browser. That forced application_packages open to everyone (the
// public key could read all 135 packages, organizer emails included), and the
// other three reads were blocked by RLS, so organizers never saw the
// speaker's name, photo, reel or event.
//
// Now the tracking code is the credential: this returns exactly the package
// it names, public-safe speaker fields, that speaker's own assets, and a
// short-lived signed link for each attached document. Contracts live in the
// private engagement-docs bucket and are never reachable any other way.
//
// verify_jwt = false: organizers have no account. Rate-limited per IP.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_SECONDS = 60 * 60; // documents open for an hour per page load
const RATE_LIMIT = 60;              // package loads per IP per hour
const RATE_WINDOW = 60 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }
  if (record.count >= RATE_LIMIT) return true;
  record.count++;
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) return json({ error: "Too many requests. Try again later." }, 429);

  const { tracking_code } = await req.json().catch(() => ({}));
  // Old links are 8 lowercase alphanumerics; new ones are longer.
  if (typeof tracking_code !== "string" || !/^[A-Za-z0-9]{6,64}$/.test(tracking_code)) {
    return json({ error: "Package not found" }, 404);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: pkg, error: pkgError } = await admin
    .from("application_packages")
    .select(`id, speaker_id, event_id, package_title, cover_message, custom_note,
             include_bio, include_headshot, include_one_sheet, include_video,
             included_assets, document_ids, expires_at`)
    .eq("tracking_code", tracking_code)
    .maybeSingle();

  if (pkgError) {
    console.error("package-view: package lookup failed:", pkgError.message);
    return json({ error: "Couldn't load this package. Try again shortly." }, 500);
  }
  if (!pkg) return json({ error: "Package not found" }, 404);
  if (pkg.expires_at && new Date(pkg.expires_at).getTime() < Date.now()) {
    return json({ error: "This package has expired. Ask the speaker for a fresh link." }, 410);
  }

  const [profileRes, assetsRes, eventRes, docsRes] = await Promise.all([
    // Public-safe fields only. Never email, phone or account data.
    admin.from("profiles")
      .select("name, headline, bio, location_city, location_country, linkedin_url, twitter_url, youtube_url")
      .eq("id", pkg.speaker_id)
      .maybeSingle(),
    admin.from("speaker_assets")
      .select("id, asset_type, file_url, created_at")
      .eq("speaker_id", pkg.speaker_id)
      .order("created_at", { ascending: false }),
    pkg.event_id
      ? admin.from("opportunities").select("event_name, organizer_name").eq("id", pkg.event_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Only documents owned by this package's speaker, whatever ids it lists.
    (pkg.document_ids ?? []).length
      ? admin.from("speaker_documents")
          .select("id, kind, title, file_path, file_name")
          .eq("speaker_id", pkg.speaker_id)
          .in("id", pkg.document_ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Assets the speaker picked for this package win; otherwise the newest of
  // each type, which is what the page always showed.
  const picked = new Set<string>(pkg.included_assets ?? []);
  const pool = (assetsRes.data ?? []) as { id: string; asset_type: string; file_url: string }[];
  const choose = (types: string[]) => {
    const ofType = pool.filter((a) => types.includes(a.asset_type));
    return (ofType.find((a) => picked.has(a.id)) ?? ofType[0])?.file_url ?? null;
  };

  const documents = [];
  for (const d of (docsRes.data ?? []) as {
    id: string; kind: string; title: string; file_path: string; file_name: string;
  }[]) {
    const { data: signed, error } = await admin.storage
      .from("engagement-docs")
      .createSignedUrl(d.file_path, SIGNED_URL_SECONDS, { download: d.file_name });
    if (error || !signed) {
      console.error("package-view: could not sign", d.id, error?.message);
      continue;
    }
    documents.push({ id: d.id, kind: d.kind, title: d.title, file_name: d.file_name, url: signed.signedUrl });
  }
  // Contract first, then tech requirements, then anything else.
  const order: Record<string, number> = { contract: 0, av_requirements: 1, other: 2 };
  documents.sort((x, y) => (order[x.kind] ?? 9) - (order[y.kind] ?? 9));

  return json({
    id: pkg.id,
    package_title: pkg.package_title,
    cover_message: pkg.cover_message,
    custom_note: pkg.custom_note,
    include_bio: pkg.include_bio,
    include_headshot: pkg.include_headshot,
    include_one_sheet: pkg.include_one_sheet,
    include_video: pkg.include_video,
    speaker: profileRes.data ?? {
      name: null, headline: null, bio: null, location_city: null, location_country: null,
      linkedin_url: null, twitter_url: null, youtube_url: null,
    },
    assets: {
      headshot: choose(["headshot"]),
      one_sheet: choose(["one_sheet"]),
      video: choose(["speaker_reel", "video"]),
    },
    event: eventRes.data ?? null,
    documents,
  });
});
