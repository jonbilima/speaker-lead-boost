import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Eye,
  Download,
  Video,
  User,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PackageStatsProps {
  matchId: string;
  eventName: string;
}

interface PackageData {
  id: string;
  tracking_code: string;
  created_at: string;
  views: {
    opened: number;
    bio_viewed: number;
    headshot_downloaded: number;
    one_sheet_downloaded: number;
    video_played: number;
    contact_clicked: number;
  };
}

export function PackageStats({ matchId, eventName }: PackageStatsProps) {
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageData | null>(null);

  useEffect(() => {
    loadPackageData();
  }, [matchId]);

  const loadPackageData = async () => {
    setLoading(true);
    
    const { data: pkg, error: pkgError } = await supabase
      .from("application_packages")
      .select("id, tracking_code, created_at")
      .eq("match_id", matchId)
      .maybeSingle();

    if (pkgError || !pkg) {
      setPackageData(null);
      setLoading(false);
      return;
    }

    // Get view stats
    const { data: views } = await supabase
      .from("package_views")
      .select("event_type")
      .eq("package_id", pkg.id);

    const viewCounts = {
      opened: 0,
      bio_viewed: 0,
      headshot_downloaded: 0,
      one_sheet_downloaded: 0,
      video_played: 0,
      contact_clicked: 0,
    };

    views?.forEach((v) => {
      if (v.event_type in viewCounts) {
        viewCounts[v.event_type as keyof typeof viewCounts]++;
      }
    });

    setPackageData({
      id: pkg.id,
      tracking_code: pkg.tracking_code,
      created_at: pkg.created_at,
      views: viewCounts,
    });
    setLoading(false);
  };

  const copyLink = () => {
    if (!packageData) return;
    const url = `${window.location.origin}/p/${packageData.tracking_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Package link copied!");
  };

  const openPackage = () => {
    if (!packageData) return;
    window.open(`/p/${packageData.tracking_code}`, "_blank");
  };

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-2" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </Card>
    );
  }

  if (!packageData) {
    return null;
  }

  const totalViews = packageData.views.opened;
  const hasEngagement = totalViews > 0;

  return (
    <Card className="p-4 space-y-3 border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-600" />
          <span className="font-medium text-sm">Application Package</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          Sent {formatDistanceToNow(new Date(packageData.created_at), { addSuffix: true })}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`p-2 rounded ${hasEngagement ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
          <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold">{totalViews}</p>
          <p className="text-xs text-muted-foreground">Opened</p>
        </div>
        <div className={`p-2 rounded ${packageData.views.video_played > 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}>
          <Video className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold">{packageData.views.video_played}</p>
          <p className="text-xs text-muted-foreground">Video Played</p>
        </div>
        <div className={`p-2 rounded ${packageData.views.one_sheet_downloaded > 0 ? "bg-purple-100 dark:bg-purple-900/30" : "bg-muted"}`}>
          <Download className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold">{packageData.views.one_sheet_downloaded}</p>
          <p className="text-xs text-muted-foreground">Downloads</p>
        </div>
      </div>

      {packageData.views.contact_clicked > 0 && (
        <Badge className="w-full justify-center bg-green-600">
          <User className="h-3 w-3 mr-1" />
          Contact clicked {packageData.views.contact_clicked} time{packageData.views.contact_clicked > 1 ? "s" : ""}!
        </Badge>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={copyLink}>
          <Copy className="h-3 w-3 mr-1" />
          Copy Link
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={openPackage}>
          <ExternalLink className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button size="sm" variant="ghost" onClick={loadPackageData}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
