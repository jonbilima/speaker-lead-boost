import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Send, Loader2 } from "lucide-react";

interface DigestPreferences {
  is_enabled: boolean;
  send_day: string;
  send_time: string;
  timezone: string;
  include_new_matches: boolean;
  include_deadlines: boolean;
  include_follow_ups: boolean;
  include_pipeline_summary: boolean;
  include_market_insights: boolean;
  include_revenue_update: boolean;
}

const DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const TIMES = [
  { value: '06:00:00', label: '6:00 AM' },
  { value: '07:00:00', label: '7:00 AM' },
  { value: '08:00:00', label: '8:00 AM' },
  { value: '09:00:00', label: '9:00 AM' },
  { value: '10:00:00', label: '10:00 AM' },
  { value: '11:00:00', label: '11:00 AM' },
  { value: '12:00:00', label: '12:00 PM' },
  { value: '13:00:00', label: '1:00 PM' },
  { value: '14:00:00', label: '2:00 PM' },
  { value: '15:00:00', label: '3:00 PM' },
  { value: '16:00:00', label: '4:00 PM' },
  { value: '17:00:00', label: '5:00 PM' },
  { value: '18:00:00', label: '6:00 PM' },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export function EmailDigestPreferences({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [preferences, setPreferences] = useState<DigestPreferences>({
    is_enabled: true,
    send_day: 'monday',
    send_time: '09:00:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    include_new_matches: true,
    include_deadlines: true,
    include_follow_ups: true,
    include_pipeline_summary: true,
    include_market_insights: true,
    include_revenue_update: true,
  });

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    const { data, error } = await supabase
      .from('email_digest_preferences')
      .select('*')
      .eq('speaker_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading preferences:', error);
    } else if (data) {
      setPreferences({
        is_enabled: data.is_enabled,
        send_day: data.send_day,
        send_time: data.send_time,
        timezone: data.timezone || 'America/New_York',
        include_new_matches: data.include_new_matches,
        include_deadlines: data.include_deadlines,
        include_follow_ups: data.include_follow_ups,
        include_pipeline_summary: data.include_pipeline_summary,
        include_market_insights: data.include_market_insights,
        include_revenue_update: data.include_revenue_update ?? true,
      });
    }
    setLoading(false);
  };

  const savePreferences = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from('email_digest_preferences')
      .upsert({
        speaker_id: userId,
        ...preferences,
      }, {
        onConflict: 'speaker_id'
      });

    if (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } else {
      toast.success('Email preferences saved!');
    }
    setSaving(false);
  };

  const sendTestDigest = async () => {
    setSendingTest(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-weekly-digest', {
        body: { 
          userId,
          isTest: true 
        }
      });

      if (error) throw error;
      toast.success('Test digest sent! Check your email.');
    } catch (error) {
      console.error('Error sending test:', error);
      toast.error('Failed to send test digest');
    }
    
    setSendingTest(false);
  };

  const updatePreference = <K extends keyof DigestPreferences>(
    key: K,
    value: DigestPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Weekly Email Digest
        </CardTitle>
        <CardDescription>
          Get a summary of your opportunities, deadlines, and insights delivered to your inbox
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="digest-enabled" className="text-base font-medium">
              Send me a weekly digest
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive a summary of your speaking opportunities each week
            </p>
          </div>
          <Switch
            id="digest-enabled"
            checked={preferences.is_enabled}
            onCheckedChange={(checked) => updatePreference('is_enabled', checked)}
          />
        </div>

        {preferences.is_enabled && (
          <>
            {/* Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={preferences.send_day}
                  onValueChange={(value) => updatePreference('send_day', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select
                  value={preferences.send_time}
                  onValueChange={(value) => updatePreference('send_time', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMES.map(time => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={preferences.timezone}
                  onValueChange={(value) => updatePreference('timezone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content Preferences */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium">What to include</Label>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-matches"
                    checked={preferences.include_new_matches}
                    onCheckedChange={(checked) => 
                      updatePreference('include_new_matches', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-matches" className="font-normal cursor-pointer">
                    New opportunities matched this week
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-deadlines"
                    checked={preferences.include_deadlines}
                    onCheckedChange={(checked) => 
                      updatePreference('include_deadlines', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-deadlines" className="font-normal cursor-pointer">
                    Upcoming deadlines (next 14 days)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-followups"
                    checked={preferences.include_follow_ups}
                    onCheckedChange={(checked) => 
                      updatePreference('include_follow_ups', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-followups" className="font-normal cursor-pointer">
                    Follow-ups due
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-pipeline"
                    checked={preferences.include_pipeline_summary}
                    onCheckedChange={(checked) => 
                      updatePreference('include_pipeline_summary', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-pipeline" className="font-normal cursor-pointer">
                    Pipeline summary (counts by stage)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-insights"
                    checked={preferences.include_market_insights}
                    onCheckedChange={(checked) => 
                      updatePreference('include_market_insights', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-insights" className="font-normal cursor-pointer">
                    Trending topics in your industries
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-revenue"
                    checked={preferences.include_revenue_update}
                    onCheckedChange={(checked) => 
                      updatePreference('include_revenue_update', checked as boolean)
                    }
                  />
                  <Label htmlFor="include-revenue" className="font-normal cursor-pointer">
                    Revenue update (if any bookings/payments)
                  </Label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={savePreferences} 
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
          
          {preferences.is_enabled && (
            <Button 
              variant="outline" 
              onClick={sendTestDigest}
              disabled={sendingTest}
            >
              {sendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Digest
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
