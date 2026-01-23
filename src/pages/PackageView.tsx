import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  FileText,
  Video,
  Image,
  Download,
  Mail,
  Play,
  MapPin,
  Globe,
  Linkedin,
  Twitter,
  Youtube,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PackageData {
  id: string;
  package_title: string;
  cover_message: string | null;
  include_bio: boolean;
  include_headshot: boolean;
  include_one_sheet: boolean;
  include_video: boolean;
  custom_note: string | null;
  speaker: {
    name: string | null;
    headline: string | null;
    bio: string | null;
    location_city: string | null;
    location_country: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    youtube_url: string | null;
  };
  assets: {
    headshot: string | null;
    one_sheet: string | null;
    video: string | null;
  };
  event: {
    event_name: string;
    organizer_name: string | null;
  } | null;
}

export default function PackageView() {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    if (trackingCode) {
      loadPackage();
    }
  }, [trackingCode]);

  const trackEvent = async (eventType: string) => {
    if (!packageData) return;
    try {
      await supabase.functions.invoke("track-package-view", {
        body: { packageId: packageData.id, eventType },
      });
    } catch (e) {
      console.error("Failed to track event:", e);
    }
  };

  const loadPackage = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get package data
      const { data: pkg, error: pkgError } = await supabase
        .from("application_packages")
        .select(`
          id,
          package_title,
          cover_message,
          include_bio,
          include_headshot,
          include_one_sheet,
          include_video,
          custom_note,
          speaker_id,
          event_id
        `)
        .eq("tracking_code", trackingCode)
        .maybeSingle();

      if (pkgError) throw pkgError;
      if (!pkg) {
        setError("Package not found or has expired");
        setLoading(false);
        return;
      }

      // Get speaker profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, headline, bio, location_city, location_country, linkedin_url, twitter_url, youtube_url")
        .eq("id", pkg.speaker_id)
        .single();

      // Get speaker assets
      const { data: assets } = await supabase
        .from("speaker_assets")
        .select("asset_type, file_url")
        .eq("speaker_id", pkg.speaker_id);

      const assetMap: PackageData["assets"] = {
        headshot: null,
        one_sheet: null,
        video: null,
      };

      assets?.forEach((a) => {
        if (a.asset_type === "headshot") assetMap.headshot = a.file_url;
        if (a.asset_type === "one_sheet") assetMap.one_sheet = a.file_url;
        if (a.asset_type === "speaker_reel" || a.asset_type === "video") assetMap.video = a.file_url;
      });

      // Get event info if linked
      let eventData = null;
      if (pkg.event_id) {
        const { data: event } = await supabase
          .from("opportunities")
          .select("event_name, organizer_name")
          .eq("id", pkg.event_id)
          .single();
        eventData = event;
      }

      setPackageData({
        id: pkg.id,
        package_title: pkg.package_title,
        cover_message: pkg.cover_message,
        include_bio: pkg.include_bio,
        include_headshot: pkg.include_headshot,
        include_one_sheet: pkg.include_one_sheet,
        include_video: pkg.include_video,
        custom_note: pkg.custom_note,
        speaker: profile || {
          name: null,
          headline: null,
          bio: null,
          location_city: null,
          location_country: null,
          linkedin_url: null,
          twitter_url: null,
          youtube_url: null,
        },
        assets: assetMap,
        event: eventData,
      });

      // Track page open
      await supabase.functions.invoke("track-package-view", {
        body: { packageId: pkg.id, eventType: "opened" },
      });
    } catch (e) {
      console.error("Error loading package:", e);
      setError("Failed to load package");
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = () => {
    trackEvent("contact_clicked");
    if (packageData?.speaker.linkedin_url) {
      window.open(packageData.speaker.linkedin_url, "_blank");
    }
  };

  const handleDownloadOneSheet = () => {
    trackEvent("one_sheet_downloaded");
    if (packageData?.assets.one_sheet) {
      window.open(packageData.assets.one_sheet, "_blank");
    }
  };

  const handleDownloadHeadshot = () => {
    trackEvent("headshot_downloaded");
    if (packageData?.assets.headshot) {
      window.open(packageData.assets.headshot, "_blank");
    }
  };

  const handlePlayVideo = () => {
    trackEvent("video_played");
    setVideoPlaying(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 dark:from-violet-950/20 dark:via-background dark:to-violet-950/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !packageData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 dark:from-violet-950/20 dark:via-background dark:to-violet-950/20 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-xl font-semibold mb-2">Package Not Found</h1>
          <p className="text-muted-foreground">
            {error || "This package may have expired or doesn't exist."}
          </p>
        </Card>
      </div>
    );
  }

  const location = [packageData.speaker.location_city, packageData.speaker.location_country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 dark:from-violet-950/20 dark:via-background dark:to-violet-950/20">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          {packageData.include_headshot && packageData.assets.headshot ? (
            <img
              src={packageData.assets.headshot}
              alt={packageData.speaker.name || "Speaker"}
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
              <User className="h-16 w-16 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">
            {packageData.speaker.name || "Speaker"}
          </h1>
          {packageData.speaker.headline && (
            <p className="text-lg text-muted-foreground mt-1">
              {packageData.speaker.headline}
            </p>
          )}
          {location && (
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-2">
              <MapPin className="h-4 w-4" />
              {location}
            </div>
          )}

          {/* Social Links */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {packageData.speaker.linkedin_url && (
              <Button
                size="icon"
                variant="outline"
                onClick={() => window.open(packageData.speaker.linkedin_url!, "_blank")}
              >
                <Linkedin className="h-4 w-4" />
              </Button>
            )}
            {packageData.speaker.twitter_url && (
              <Button
                size="icon"
                variant="outline"
                onClick={() => window.open(packageData.speaker.twitter_url!, "_blank")}
              >
                <Twitter className="h-4 w-4" />
              </Button>
            )}
            {packageData.speaker.youtube_url && (
              <Button
                size="icon"
                variant="outline"
                onClick={() => window.open(packageData.speaker.youtube_url!, "_blank")}
              >
                <Youtube className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Event Badge */}
        {packageData.event && (
          <div className="text-center mb-6">
            <Badge variant="secondary" className="text-sm px-4 py-1">
              Application for: {packageData.event.event_name}
            </Badge>
          </div>
        )}

        {/* Cover Message */}
        {packageData.cover_message && (
          <Card className="p-6 mb-6 bg-white/80 dark:bg-background/80 backdrop-blur">
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {packageData.cover_message}
            </p>
          </Card>
        )}

        {/* Bio Section */}
        {packageData.include_bio && packageData.speaker.bio && (
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-violet-600" />
              About
            </h2>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {packageData.speaker.bio}
            </p>
          </Card>
        )}

        {/* Video Section */}
        {packageData.include_video && packageData.assets.video && (
          <Card className="p-6 mb-6 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Video className="h-5 w-5 text-violet-600" />
              Speaker Reel
            </h2>
            {videoPlaying ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <video
                  src={packageData.assets.video}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div
                className="aspect-video rounded-lg bg-gradient-to-br from-violet-900 to-violet-950 flex items-center justify-center cursor-pointer group"
                onClick={handlePlayVideo}
              >
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="h-10 w-10 text-white ml-1" />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Custom Note */}
        {packageData.custom_note && (
          <Card className="p-6 mb-6 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800">
            <p className="text-sm text-foreground italic">
              "{packageData.custom_note}"
            </p>
          </Card>
        )}

        {/* Download Section */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {packageData.include_headshot && packageData.assets.headshot && (
            <Button variant="outline" onClick={handleDownloadHeadshot}>
              <Image className="h-4 w-4 mr-2" />
              Download Headshot
            </Button>
          )}
          {packageData.include_one_sheet && packageData.assets.one_sheet && (
            <Button variant="outline" onClick={handleDownloadOneSheet}>
              <Download className="h-4 w-4 mr-2" />
              Download One-Sheet
            </Button>
          )}
        </div>

        <Separator className="my-8" />

        {/* Contact CTA */}
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-4">
            Interested in booking {packageData.speaker.name?.split(" ")[0] || "this speaker"}?
          </h3>
          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-700"
            onClick={handleContactClick}
          >
            <Mail className="h-5 w-5 mr-2" />
            Get in Touch
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground space-y-2">
          <p>Powered by NextMic</p>
          <p className="text-xs opacity-75">
            Anonymous analytics (device type, page views) are collected to improve this service.
          </p>
        </div>
      </div>
    </div>
  );
}
