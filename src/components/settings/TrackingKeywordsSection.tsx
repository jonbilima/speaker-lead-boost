import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, ExternalLink, Plus, X, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrackingKeywordsSectionProps {
  speakerId: string;
  userTopics: string[];
}

export function TrackingKeywordsSection({ speakerId, userTopics }: TrackingKeywordsSectionProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadKeywords();
  }, [speakerId]);

  const loadKeywords = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("tracking_keywords")
        .eq("id", speakerId)
        .single();

      if (error) throw error;
      setKeywords(data?.tracking_keywords || []);
    } catch (error) {
      console.error("Error loading keywords:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveKeywords = async (newKeywords: string[]) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ tracking_keywords: newKeywords })
        .eq("id", speakerId);

      if (error) throw error;
      setKeywords(newKeywords);
    } catch (error) {
      console.error("Error saving keywords:", error);
      toast.error("Failed to save keywords");
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    if (keywords.includes(newKeyword.trim())) {
      toast.error("Keyword already exists");
      return;
    }
    saveKeywords([...keywords, newKeyword.trim()]);
    setNewKeyword("");
    toast.success("Keyword added");
  };

  const removeKeyword = (keyword: string) => {
    saveKeywords(keywords.filter((k) => k !== keyword));
  };

  const suggestedKeywords = [
    "seeking keynote speaker",
    "call for speakers",
    "looking for presenters",
    "speaker wanted",
    ...userTopics.slice(0, 3).map((t) => `${t} speaker needed`),
  ];

  const googleAlertsQuery = [...keywords, ...userTopics.slice(0, 2)]
    .slice(0, 5)
    .map((k) => `"${k}"`)
    .join(" OR ");

  const googleAlertsUrl = `https://www.google.com/alerts#1:0`;

  const copyAlertQuery = () => {
    navigator.clipboard.writeText(googleAlertsQuery);
    setCopied(true);
    toast.success("Query copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Track Keywords
        </CardTitle>
        <CardDescription>
          Get notified when speaking opportunities matching your keywords appear
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Keywords */}
        <div>
          <label className="text-sm font-medium mb-2 block">Your Keywords</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keywords added yet</p>
            ) : (
              keywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(keyword)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., AI keynote speaker"
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            />
            <Button onClick={addKeyword} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <label className="text-sm font-medium mb-2 block">Suggested Keywords</label>
          <div className="flex flex-wrap gap-2">
            {suggestedKeywords
              .filter((s) => !keywords.includes(s))
              .slice(0, 5)
              .map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => saveKeywords([...keywords, suggestion])}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {suggestion}
                </Button>
              ))}
          </div>
        </div>

        {/* Google Alerts Integration */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">Set up Google Alerts for real-time notifications</p>
            <p className="text-sm">
              Create a Google Alert with your keywords to get email notifications when new opportunities appear online.
            </p>
            <div className="bg-muted rounded-md p-3 text-xs font-mono break-all">
              {googleAlertsQuery || "(Add keywords to generate query)"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyAlertQuery}
                disabled={!googleAlertsQuery}
              >
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy Query
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(googleAlertsUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Google Alerts
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}