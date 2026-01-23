import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  Sparkles,
  Eye,
  User,
  FileText,
  Video,
  Image,
  Quote,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PipelineOpportunity } from "./PipelineCard";

interface PackageBuilderDialogProps {
  opportunity: PipelineOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageCreated: () => void;
}

interface SpeakerAsset {
  id: string;
  asset_type: string;
  file_name: string;
  title: string | null;
}

export function PackageBuilderDialog({
  opportunity,
  open,
  onOpenChange,
  onPackageCreated,
}: PackageBuilderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [assets, setAssets] = useState<SpeakerAsset[]>([]);
  
  // Form state
  const [packageTitle, setPackageTitle] = useState("");
  const [coverMessage, setCoverMessage] = useState("");
  const [includeBio, setIncludeBio] = useState(true);
  const [includeHeadshot, setIncludeHeadshot] = useState(true);
  const [includeOneSheet, setIncludeOneSheet] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (open && opportunity) {
      loadData();
      setPackageTitle(`Application Package for ${opportunity.event_name}`);
    }
  }, [open, opportunity]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load profile and assets in parallel
    const [profileRes, assetsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("speaker_assets").select("id, asset_type, file_name, title").eq("speaker_id", session.user.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (assetsRes.data) {
      setAssets(assetsRes.data);
      // Auto-check if user has one-sheet or video
      const hasOneSheet = assetsRes.data.some(a => a.asset_type === "one_sheet");
      const hasVideo = assetsRes.data.some(a => a.asset_type === "speaker_reel" || a.asset_type === "video");
      setIncludeOneSheet(hasOneSheet);
      setIncludeVideo(hasVideo);
    }

    setLoading(false);
  };

  const generateCoverMessage = async () => {
    if (!opportunity || !profile) return;
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-package-cover", {
        body: {
          eventName: opportunity.event_name,
          eventDescription: opportunity.description,
          organizerName: opportunity.organizer_name,
          speakerName: profile.name,
          speakerBio: profile.bio,
          speakerHeadline: profile.headline,
        },
      });

      if (error) throw error;
      setCoverMessage(data.coverMessage);
      toast.success("Cover message generated!");
    } catch (error) {
      console.error("Error generating cover:", error);
      toast.error("Failed to generate cover message");
    } finally {
      setGenerating(false);
    }
  };

  const generateTrackingCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createPackage = async () => {
    if (!opportunity || !profile) return;
    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const trackingCode = generateTrackingCode();

      const { error } = await supabase.from("application_packages").insert({
        speaker_id: session.user.id,
        match_id: opportunity.score_id,
        event_id: opportunity.id,
        tracking_code: trackingCode,
        package_title: packageTitle,
        cover_message: coverMessage,
        included_assets: selectedAssets,
        include_bio: includeBio,
        include_headshot: includeHeadshot,
        include_one_sheet: includeOneSheet,
        include_video: includeVideo,
        custom_note: customNote || null,
      });

      if (error) throw error;

      const packageUrl = `${window.location.origin}/p/${trackingCode}`;
      
      toast.success(
        <div className="flex flex-col gap-2">
          <span>Package created!</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(packageUrl);
              toast.success("Link copied!");
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Link
          </Button>
        </div>,
        { duration: 10000 }
      );

      onPackageCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating package:", error);
      toast.error("Failed to create package");
    } finally {
      setCreating(false);
    }
  };

  if (!opportunity) return null;

  const headshotAsset = assets.find(a => a.asset_type === "headshot");
  const oneSheetAsset = assets.find(a => a.asset_type === "one_sheet");
  const videoAsset = assets.find(a => a.asset_type === "speaker_reel" || a.asset_type === "video");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-600" />
            Create Application Package
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : (
          <Tabs defaultValue="build" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="build">Build Package</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="build" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Package Title</Label>
                  <Input
                    value={packageTitle}
                    onChange={(e) => setPackageTitle(e.target.value)}
                    placeholder="Enter package title..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cover Message</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateCoverMessage}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      {generating ? "Generating..." : "Generate with AI"}
                    </Button>
                  </div>
                  <Textarea
                    value={coverMessage}
                    onChange={(e) => setCoverMessage(e.target.value)}
                    placeholder="Write a personalized message for the organizer..."
                    rows={6}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Include in Package</Label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="include-bio"
                          checked={includeBio}
                          onCheckedChange={(checked) => setIncludeBio(checked as boolean)}
                        />
                        <Label htmlFor="include-bio" className="flex items-center gap-2 cursor-pointer">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Speaker Bio
                        </Label>
                      </div>
                    </Card>

                    <Card className={`p-3 ${!headshotAsset ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="include-headshot"
                          checked={includeHeadshot}
                          onCheckedChange={(checked) => setIncludeHeadshot(checked as boolean)}
                          disabled={!headshotAsset}
                        />
                        <Label htmlFor="include-headshot" className="flex items-center gap-2 cursor-pointer">
                          <Image className="h-4 w-4 text-muted-foreground" />
                          Headshot
                          {!headshotAsset && <span className="text-xs text-muted-foreground">(not uploaded)</span>}
                        </Label>
                      </div>
                    </Card>

                    <Card className={`p-3 ${!oneSheetAsset ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="include-one-sheet"
                          checked={includeOneSheet}
                          onCheckedChange={(checked) => setIncludeOneSheet(checked as boolean)}
                          disabled={!oneSheetAsset}
                        />
                        <Label htmlFor="include-one-sheet" className="flex items-center gap-2 cursor-pointer">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          One-Sheet PDF
                          {!oneSheetAsset && <span className="text-xs text-muted-foreground">(not uploaded)</span>}
                        </Label>
                      </div>
                    </Card>

                    <Card className={`p-3 ${!videoAsset ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="include-video"
                          checked={includeVideo}
                          onCheckedChange={(checked) => setIncludeVideo(checked as boolean)}
                          disabled={!videoAsset}
                        />
                        <Label htmlFor="include-video" className="flex items-center gap-2 cursor-pointer">
                          <Video className="h-4 w-4 text-muted-foreground" />
                          Video Reel
                          {!videoAsset && <span className="text-xs text-muted-foreground">(not uploaded)</span>}
                        </Label>
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Custom Note (Optional)</Label>
                  <Textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Add any additional notes for this specific application..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <Card className="p-6 space-y-6 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-background">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{profile?.name || "Speaker Name"}</h2>
                      <p className="text-muted-foreground">{profile?.headline || "Professional Speaker"}</p>
                    </div>
                  </div>

                  {coverMessage && (
                    <Card className="p-4 bg-white/50 dark:bg-background/50">
                      <p className="text-sm whitespace-pre-wrap">{coverMessage}</p>
                    </Card>
                  )}

                  {includeBio && profile?.bio && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" /> About
                      </h3>
                      <p className="text-sm text-muted-foreground">{profile.bio}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-center">
                    {includeHeadshot && headshotAsset && (
                      <Button size="sm" variant="outline">
                        <Image className="h-4 w-4 mr-1" /> View Headshot
                      </Button>
                    )}
                    {includeOneSheet && oneSheetAsset && (
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-1" /> Download One-Sheet
                      </Button>
                    )}
                    {includeVideo && videoAsset && (
                      <Button size="sm" variant="outline">
                        <Video className="h-4 w-4 mr-1" /> Watch Video
                      </Button>
                    )}
                  </div>

                  <div className="text-center pt-4 border-t">
                    <Button className="bg-violet-600 hover:bg-violet-700">
                      <Quote className="h-4 w-4 mr-2" />
                      Contact {profile?.name?.split(" ")[0] || "Speaker"}
                    </Button>
                  </div>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={createPackage}
            disabled={creating || !packageTitle || !coverMessage}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            {creating ? "Creating..." : "Create Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
