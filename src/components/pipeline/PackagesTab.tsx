import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Package,
  Eye,
  Download,
  Video,
  User,
  ExternalLink,
  Copy,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface PackageWithStats {
  id: string;
  tracking_code: string;
  package_title: string;
  created_at: string;
  event_name: string | null;
  views: {
    opened: number;
    video_played: number;
    one_sheet_downloaded: number;
    contact_clicked: number;
  };
}

export function PackagesTab() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageWithStats[]>([]);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get all packages
    const { data: pkgs, error } = await supabase
      .from("application_packages")
      .select(`
        id,
        tracking_code,
        package_title,
        created_at,
        opportunities (event_name)
      `)
      .eq("speaker_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading packages:", error);
      setLoading(false);
      return;
    }

    // Get view stats for all packages
    const packageIds = pkgs?.map((p) => p.id) || [];
    
    const { data: views } = await supabase
      .from("package_views")
      .select("package_id, event_type")
      .in("package_id", packageIds);

    // Aggregate views by package
    const viewsByPackage: Record<string, PackageWithStats["views"]> = {};
    
    packageIds.forEach((id) => {
      viewsByPackage[id] = {
        opened: 0,
        video_played: 0,
        one_sheet_downloaded: 0,
        contact_clicked: 0,
      };
    });

    views?.forEach((v) => {
      if (viewsByPackage[v.package_id]) {
        if (v.event_type === "opened") viewsByPackage[v.package_id].opened++;
        if (v.event_type === "video_played") viewsByPackage[v.package_id].video_played++;
        if (v.event_type === "one_sheet_downloaded") viewsByPackage[v.package_id].one_sheet_downloaded++;
        if (v.event_type === "contact_clicked") viewsByPackage[v.package_id].contact_clicked++;
      }
    });

    const packagesWithStats: PackageWithStats[] = (pkgs || []).map((p: any) => ({
      id: p.id,
      tracking_code: p.tracking_code,
      package_title: p.package_title,
      created_at: p.created_at,
      event_name: p.opportunities?.event_name || null,
      views: viewsByPackage[p.id] || {
        opened: 0,
        video_played: 0,
        one_sheet_downloaded: 0,
        contact_clicked: 0,
      },
    }));

    setPackages(packagesWithStats);
    setLoading(false);
  };

  const copyLink = (trackingCode: string) => {
    const url = `${window.location.origin}/p/${trackingCode}`;
    navigator.clipboard.writeText(url);
    toast.success("Package link copied!");
  };

  const openPackage = (trackingCode: string) => {
    window.open(`/p/${trackingCode}`, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </Card>
        ))}
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="font-medium mb-2">No Packages Sent</h3>
        <p className="text-sm text-muted-foreground">
          Create your first application package from an opportunity detail view
        </p>
      </Card>
    );
  }

  // Calculate totals
  const totals = packages.reduce(
    (acc, p) => ({
      opened: acc.opened + p.views.opened,
      video: acc.video + p.views.video_played,
      downloads: acc.downloads + p.views.one_sheet_downloaded,
      contacts: acc.contacts + p.views.contact_clicked,
    }),
    { opened: 0, video: 0, downloads: 0, contacts: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-bold">{totals.opened}</p>
          <p className="text-xs text-muted-foreground">Total Views</p>
        </Card>
        <Card className="p-3 text-center">
          <Video className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-bold">{totals.video}</p>
          <p className="text-xs text-muted-foreground">Videos Played</p>
        </Card>
        <Card className="p-3 text-center">
          <Download className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xl font-bold">{totals.downloads}</p>
          <p className="text-xs text-muted-foreground">Downloads</p>
        </Card>
        <Card className="p-3 text-center bg-green-50 dark:bg-green-950/30">
          <User className="h-4 w-4 mx-auto mb-1 text-green-600" />
          <p className="text-xl font-bold text-green-600">{totals.contacts}</p>
          <p className="text-xs text-muted-foreground">Contacts</p>
        </Card>
      </div>

      {/* Package List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{pkg.package_title}</h4>
                  {pkg.event_name && (
                    <p className="text-sm text-muted-foreground truncate">
                      {pkg.event_name}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(pkg.created_at), { addSuffix: true })}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {pkg.views.contact_clicked > 0 && (
                    <Badge className="bg-green-600">
                      <User className="h-3 w-3 mr-1" />
                      {pkg.views.contact_clicked} contact{pkg.views.contact_clicked > 1 ? "s" : ""}
                    </Badge>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {pkg.views.opened}
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="h-3 w-3" /> {pkg.views.video_played}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" /> {pkg.views.one_sheet_downloaded}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyLink(pkg.tracking_code)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openPackage(pkg.tracking_code)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
