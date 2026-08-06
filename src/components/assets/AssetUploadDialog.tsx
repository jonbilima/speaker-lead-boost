import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ASSET_TYPES, formatFileSize, getAssetTypeConfig } from "./AssetTypes";

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetUploaded: () => void;
  defaultAssetType?: string;
}

export function AssetUploadDialog({
  open,
  onOpenChange,
  onAssetUploaded,
  defaultAssetType,
}: AssetUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [assetType, setAssetType] = useState(defaultAssetType || "headshot");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Link-first for reels/videos: real demo reels live on YouTube/Vimeo/Drive
  // and organizers want a link to click; storage upload is the fallback
  // (bucket caps objects at 50MB, so most raw video bounces anyway).
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [linkUrl, setLinkUrl] = useState("");

  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // must match speaker-assets bucket limit

  const typeConfig = getAssetTypeConfig(assetType);
  const linkFirst = assetType === "speaker_reel" || assetType === "video";

  const resetForm = () => {
    setAssetType(defaultAssetType || "headshot");
    setTitle("");
    setDescription("");
    setFile(null);
    setLinkUrl("");
    setMode("link");
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        if (droppedFile.size > 50 * 1024 * 1024) {
          toast.error(`That file is ${formatFileSize(droppedFile.size)} — uploads max out at 50MB. For demo reels, paste a YouTube/Vimeo/Drive link instead (it's also what organizers prefer to click).`);
          return;
        }
        setFile(droppedFile);
        if (!title) {
          setTitle(droppedFile.name.split(".")[0]);
        }
      }
    },
    [title]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_UPLOAD_BYTES) {
        toast.error(`That file is ${formatFileSize(selectedFile.size)} — uploads max out at 50MB. For demo reels, paste a YouTube/Vimeo/Drive link instead (it's also what organizers prefer to click).`);
        e.target.value = "";
        return;
      }
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.split(".")[0]);
      }
    }
  };

  const saveLink = async () => {
    let url = linkUrl.trim();
    if (!url) { toast.error("Paste a link first (YouTube, Vimeo, or Drive)"); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { new URL(url); } catch { toast.error("That doesn't look like a valid link"); return; }
    setUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); setUploading(false); return; }
    let dbAssetType: "headshot" | "speaker_reel" | "one_sheet" | "slide_deck" | "video" | "audio" | "document" | "other" = "other";
    if (assetType === "speaker_reel") dbAssetType = "speaker_reel";
    else if (assetType === "video") dbAssetType = "video";
    const { error } = await supabase.from("speaker_assets").insert({
      speaker_id: session.user.id,
      asset_type: dbAssetType,
      file_name: "External link",
      file_url: url,
      file_size: null,
      mime_type: null,
      title: title || url.replace(/^https?:\/\//, "").slice(0, 60),
      description: description || null,
      is_primary: false,
      view_count: 0,
      download_count: 0,
    });
    setUploading(false);
    if (error) { toast.error(error.message || "Couldn't save the link"); return; }
    toast.success("Link added!");
    resetForm();
    onOpenChange(false);
    onAssetUploaded();
  };

  const handleUpload = async () => {
    if (mode === "link" && linkFirst) { await saveLink(); return; }
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${formatFileSize(file.size)} — uploads max out at 50MB. Paste a hosted link instead.`);
      return;
    }

    setUploading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      setUploading(false);
      return;
    }

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const ext = file.name.split(".").pop();
      const filePath = `${session.user.id}/${assetType}/${timestamp}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("speaker-assets")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("speaker-assets")
        .getPublicUrl(filePath);

      // Map UI asset type to database enum
      let dbAssetType: "headshot" | "speaker_reel" | "one_sheet" | "slide_deck" | "video" | "audio" | "document" | "other" = "other";
      if (assetType === "headshot") dbAssetType = "headshot";
      else if (assetType === "speaker_reel") dbAssetType = "speaker_reel";
      else if (assetType === "one_sheet") dbAssetType = "one_sheet";
      else if (assetType === "slide_deck") dbAssetType = "slide_deck";
      else if (assetType === "document") dbAssetType = "document";

      // Save metadata to database
      const { error: dbError } = await supabase.from("speaker_assets").insert({
        speaker_id: session.user.id,
        asset_type: dbAssetType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        title: title || file.name,
        description: description || null,
        is_primary: false,
        view_count: 0,
        download_count: 0,
      });

      if (dbError) throw dbError;

      toast.success("Asset uploaded successfully!");
      resetForm();
      onOpenChange(false);
      onAssetUploaded();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload asset");
    }

    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Asset Type</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {linkFirst && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="asset-link">{mode === "link" ? "Link (YouTube, Vimeo, Drive)" : "Upload a file"}</Label>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs"
                  onClick={() => setMode(mode === "link" ? "upload" : "link")}>
                  {mode === "link" ? "or upload a file instead" : "or paste a link instead"}
                </Button>
              </div>
              {mode === "link" && (
                <Input id="asset-link" type="url" placeholder="https://youtube.com/watch?v=…"
                  value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              )}
            </div>
          )}

          {/* Drop Zone */}
          {(!linkFirst || mode === "upload") && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              dragOver ? "border-violet-500 bg-violet-50" : "border-border",
              file && "border-green-500 bg-green-50"
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <File className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-sm truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your file here, or
                </p>
                <label>
                  <input
                    type="file"
                    accept={typeConfig.accept}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </>
            )}
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Professional Headshot 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={handleUpload}
              disabled={uploading || (mode === "link" && linkFirst ? !linkUrl.trim() : !file)}
            >
              {uploading ? "Saving..." : (mode === "link" && linkFirst ? "Add Link" : "Upload")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
