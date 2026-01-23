import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Copy, Check, ExternalLink, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WidgetSettings } from "./WidgetTypes";

interface EmbedWidgetSectionProps {
  speakerId: string;
  slug: string | null;
  isPublic: boolean;
}

export function EmbedWidgetSection({ speakerId, slug, isPublic }: EmbedWidgetSectionProps) {
  const [settings, setSettings] = useState<WidgetSettings>({
    primary_color: "#8B5CF6",
    show_photo: true,
    show_topics: true,
    show_availability: true,
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [speakerId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("widget_settings")
      .eq("id", speakerId)
      .single();

    if (data?.widget_settings && typeof data.widget_settings === 'object') {
      const ws = data.widget_settings as Record<string, unknown>;
      setSettings({
        primary_color: (ws.primary_color as string) || "#8B5CF6",
        show_photo: ws.show_photo !== false,
        show_topics: ws.show_topics !== false,
        show_availability: ws.show_availability !== false,
      });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    const settingsJson = {
      primary_color: settings.primary_color,
      show_photo: settings.show_photo,
      show_topics: settings.show_topics,
      show_availability: settings.show_availability,
    };
    const { error } = await supabase
      .from("profiles")
      .update({ widget_settings: settingsJson })
      .eq("id", speakerId);

    setSaving(false);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Widget settings saved");
    }
  };

  const baseUrl = window.location.origin;
  const embedUrl = `${baseUrl}/embed/${slug}`;

  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="400" 
  height="500" 
  frameborder="0" 
  style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
</iframe>`;

  const scriptCode = `<div id="nextmic-widget" data-speaker="${slug}"></div>
<script src="${baseUrl}/widget.js" async></script>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isPublic || !slug) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Code className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-medium mb-2">Enable Public Profile First</h3>
          <p className="text-sm text-muted-foreground">
            Your profile must be public and have a custom URL slug to use the embeddable widget.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Code className="h-5 w-5 text-violet-600" />
            Embeddable Widget
          </h3>
          <p className="text-sm text-muted-foreground">
            Add a booking widget to your website
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(embedUrl, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Preview
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Widget Preview */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Preview</Label>
          <div 
            className="border rounded-lg overflow-hidden"
            style={{ maxWidth: 400, height: 500 }}
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
          </div>
        </div>

        {/* Settings & Code */}
        <div className="space-y-6">
          {/* Customization */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Customize
            </h4>
            
            <div>
              <Label className="text-sm">Primary Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-12 h-9 p-1"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Photo</Label>
                <Switch
                  checked={settings.show_photo}
                  onCheckedChange={(v) => setSettings({ ...settings, show_photo: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Topics</Label>
                <Switch
                  checked={settings.show_topics}
                  onCheckedChange={(v) => setSettings({ ...settings, show_topics: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Availability</Label>
                <Switch
                  checked={settings.show_availability}
                  onCheckedChange={(v) => setSettings({ ...settings, show_availability: v })}
                />
              </div>
            </div>

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          {/* Embed Codes */}
          <div>
            <h4 className="font-medium mb-3">Embed Code</h4>
            <Tabs defaultValue="iframe">
              <TabsList className="w-full">
                <TabsTrigger value="iframe" className="flex-1">iFrame</TabsTrigger>
                <TabsTrigger value="script" className="flex-1">JavaScript</TabsTrigger>
              </TabsList>
              
              <TabsContent value="iframe" className="mt-3">
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                    {iframeCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(iframeCode, "iframe")}
                  >
                    {copied === "iframe" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="script" className="mt-3">
                <div className="relative">
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                    {scriptCode}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(scriptCode, "script")}
                  >
                    {copied === "script" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <Badge variant="outline" className="text-xs">Coming soon</Badge>
                  {" "}JavaScript widget with more customization options
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Card>
  );
}
