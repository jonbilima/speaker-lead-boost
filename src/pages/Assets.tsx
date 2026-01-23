import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, Upload, ExternalLink, RefreshCw, Quote, Code } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AssetTypeSummary } from "@/components/assets/AssetTypeSummary";
import { AssetUploadDialog } from "@/components/assets/AssetUploadDialog";
import { AssetCard } from "@/components/assets/AssetCard";
import { ASSET_TYPES, SpeakerAsset } from "@/components/assets/AssetTypes";
import { TestimonialsTab } from "@/components/testimonials/TestimonialsTab";
import { EmbedWidgetSection } from "@/components/widget/EmbedWidgetSection";

const Assets = () => {
  const [assets, setAssets] = useState<SpeakerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"assets" | "testimonials" | "widget">("assets");
  const [profile, setProfile] = useState<{ slug: string | null; is_public: boolean; id: string } | null>(null);

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);

    // Load assets
    const { data: assetsData, error: assetsError } = await supabase
      .from("speaker_assets")
      .select("*")
      .eq("speaker_id", session.user.id)
      .order("created_at", { ascending: false });

    if (assetsError) {
      console.error("Error loading assets:", assetsError);
      toast.error("Failed to load assets");
    } else {
      setAssets(assetsData || []);
    }

    // Load profile for public page link
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, slug, is_public")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAssetCountByType = (typeId: string) => {
    // Map UI types to database types
    const dbType = typeId === "speaker_reel" ? "speaker_reel" : typeId;
    return assets.filter((a) => a.asset_type === dbType).length;
  };

  const getFilteredAssets = () => {
    if (selectedType === "all") return assets;
    return assets.filter((a) => a.asset_type === selectedType);
  };

  const totalAssets = assets.length;
  const filteredAssets = getFilteredAssets();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-violet-600" />
              Speaker Assets
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your headshots, speaker reels, and marketing materials
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.is_public && profile?.slug && (
              <Button
                variant="outline"
                onClick={() => window.open(`/speakers/${profile.slug}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public Page
              </Button>
            )}
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Asset
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "assets" | "testimonials" | "widget")}>
          <TabsList>
            <TabsTrigger value="assets">
              <FolderOpen className="h-4 w-4 mr-2" />
              Assets ({totalAssets})
            </TabsTrigger>
            <TabsTrigger value="testimonials">
              <Quote className="h-4 w-4 mr-2" />
              Testimonials
            </TabsTrigger>
            <TabsTrigger value="widget">
              <Code className="h-4 w-4 mr-2" />
              Embed Widget
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ASSET_TYPES.map((type) => (
                <AssetTypeSummary
                  key={type.id}
                  assetType={type}
                  count={getAssetCountByType(type.id)}
                  onClick={() => setSelectedType(type.id === selectedType ? "all" : type.id)}
                  isSelected={selectedType === type.id}
                />
              ))}
            </div>

            {/* Asset Type Tabs */}
            <Tabs value={selectedType} onValueChange={setSelectedType}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({totalAssets})
                </TabsTrigger>
                {ASSET_TYPES.map((type) => {
                  const count = getAssetCountByType(type.id);
                  return (
                    <TabsTrigger key={type.id} value={type.id}>
                      {type.label.split(" ")[0]} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={selectedType} className="mt-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <Card className="p-12 text-center">
                    <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <h3 className="font-medium mb-2">No assets uploaded yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedType === "all"
                        ? "Upload your first headshot or speaker reel to get started"
                        : `No ${ASSET_TYPES.find((t) => t.id === selectedType)?.label.toLowerCase()} uploaded yet`}
                    </p>
                    <Button
                      onClick={() => setUploadDialogOpen(true)}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Your First Asset
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onUpdate={loadData}
                        onDelete={loadData}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="testimonials" className="mt-6">
            <TestimonialsTab />
          </TabsContent>

          <TabsContent value="widget" className="mt-6">
            {profile && (
              <EmbedWidgetSection
                speakerId={profile.id}
                slug={profile.slug}
                isPublic={profile.is_public}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AssetUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onAssetUploaded={loadData}
        defaultAssetType={selectedType !== "all" ? selectedType : undefined}
      />
    </AppLayout>
  );
};

export default Assets;
