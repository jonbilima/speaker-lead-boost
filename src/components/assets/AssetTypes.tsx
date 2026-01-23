import { Image, FileText, Video, Presentation, MessageSquareQuote } from "lucide-react";

export interface SpeakerAsset {
  id: string;
  speaker_id: string;
  asset_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  title: string | null;
  description: string | null;
  is_primary: boolean;
  view_count: number;
  download_count: number;
  created_at: string;
}

export const ASSET_TYPES = [
  {
    id: "headshot",
    label: "Headshot",
    icon: Image,
    accept: "image/*",
    color: "bg-violet-500",
    borderColor: "border-violet-500",
    bgLight: "bg-violet-50",
  },
  {
    id: "one_sheet",
    label: "One-Sheet / Speaker Kit",
    icon: FileText,
    accept: ".pdf",
    color: "bg-blue-500",
    borderColor: "border-blue-500",
    bgLight: "bg-blue-50",
  },
  {
    id: "speaker_reel",
    label: "Video Reel / Demo",
    icon: Video,
    accept: "video/*",
    color: "bg-red-500",
    borderColor: "border-red-500",
    bgLight: "bg-red-50",
  },
  {
    id: "slide_deck",
    label: "Slide Deck",
    icon: Presentation,
    accept: ".pdf,.ppt,.pptx",
    color: "bg-orange-500",
    borderColor: "border-orange-500",
    bgLight: "bg-orange-50",
  },
  {
    id: "document",
    label: "Testimonials / Documents",
    icon: MessageSquareQuote,
    accept: ".pdf,.doc,.docx",
    color: "bg-green-500",
    borderColor: "border-green-500",
    bgLight: "bg-green-50",
  },
] as const;

export function getAssetTypeConfig(assetType: string) {
  return ASSET_TYPES.find((t) => t.id === assetType) || ASSET_TYPES[0];
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
