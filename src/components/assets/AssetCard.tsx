import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  MoreVertical,
  Download,
  Link,
  Trash2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SpeakerAsset, getAssetTypeConfig, formatFileSize } from "./AssetTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AssetCardProps {
  asset: SpeakerAsset;
  onUpdate: () => void;
  onDelete: () => void;
}

export function AssetCard({ asset, onUpdate, onDelete }: AssetCardProps) {
  const typeConfig = getAssetTypeConfig(asset.asset_type);
  const isImage = asset.mime_type?.startsWith("image/");
  const isVideo = asset.mime_type?.startsWith("video/");

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(asset.file_url);
    toast.success("URL copied to clipboard");
  };

  const handleDownload = async () => {
    // Increment download count
    await supabase
      .from("speaker_assets")
      .update({ download_count: asset.download_count + 1 })
      .eq("id", asset.id);

    // Trigger download
    const link = document.createElement("a");
    link.href = asset.file_url;
    link.download = asset.file_name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onUpdate();
  };

  const handleSetPrimary = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Map the asset_type to database enum type
    const dbAssetType = asset.asset_type as "headshot" | "speaker_reel" | "one_sheet" | "slide_deck" | "video" | "audio" | "document" | "other";

    // Unset other primary assets of same type
    await supabase
      .from("speaker_assets")
      .update({ is_primary: false })
      .eq("speaker_id", session.user.id)
      .eq("asset_type", dbAssetType);

    // Set this one as primary
    await supabase
      .from("speaker_assets")
      .update({ is_primary: true })
      .eq("id", asset.id);

    toast.success("Set as primary asset");
    onUpdate();
  };

  const handleDelete = async () => {
    // Extract file path from URL
    const urlParts = asset.file_url.split("/speaker-assets/");
    const filePath = urlParts[1];

    if (filePath) {
      // Delete from storage
      await supabase.storage.from("speaker-assets").remove([filePath]);
    }

    // Delete from database
    const { error } = await supabase
      .from("speaker_assets")
      .delete()
      .eq("id", asset.id);

    if (error) {
      toast.error("Failed to delete asset");
    } else {
      toast.success("Asset deleted");
      onDelete();
    }
  };

  const handleView = async () => {
    // Increment view count
    await supabase
      .from("speaker_assets")
      .update({ view_count: asset.view_count + 1 })
      .eq("id", asset.id);

    window.open(asset.file_url, "_blank");
    onUpdate();
  };

  const Icon = typeConfig.icon;

  return (
    <Card className="overflow-hidden group">
      {/* Thumbnail */}
      <div
        className="aspect-video bg-muted relative cursor-pointer"
        onClick={handleView}
      >
        {isImage ? (
          <img
            src={asset.file_url}
            alt={asset.title || "Asset"}
            className="w-full h-full object-cover"
          />
        ) : isVideo ? (
          <video
            src={asset.file_url}
            className="w-full h-full object-cover"
            muted
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button variant="secondary" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </div>

        {/* Primary badge */}
        {asset.is_primary && (
          <Badge className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600">
            <Star className="h-3 w-3 mr-1 fill-current" />
            Primary
          </Badge>
        )}

        {/* Type badge */}
        <Badge
          className={cn(
            "absolute top-2 right-2",
            typeConfig.color,
            "hover:opacity-90"
          )}
        >
          {typeConfig.label}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">
              {asset.title || asset.file_name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(asset.file_size)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyUrl}>
                <Link className="h-4 w-4 mr-2" />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              {!asset.is_primary && (
                <DropdownMenuItem onClick={handleSetPrimary}>
                  <Star className="h-4 w-4 mr-2" />
                  Set as Primary
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {asset.view_count} views
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {asset.download_count} downloads
          </span>
        </div>
      </div>
    </Card>
  );
}
