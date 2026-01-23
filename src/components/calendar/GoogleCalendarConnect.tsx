import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Link2, 
  Unlink, 
  Check, 
  Loader2, 
  AlertCircle,
  Calendar as CalendarIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Google Calendar icon
const GoogleCalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 10H20" stroke="currentColor" strokeWidth="2"/>
    <circle cx="8" cy="14" r="1" fill="#4285F4"/>
    <circle cx="12" cy="14" r="1" fill="#34A853"/>
    <circle cx="16" cy="14" r="1" fill="#FBBC05"/>
  </svg>
);

interface CalendarConnection {
  id: string;
  email: string | null;
  is_active: boolean;
  auto_sync_speaking: boolean;
  show_external_events: boolean;
  last_sync_at: string | null;
  sync_errors: string[];
}

interface GoogleCalendarConnectProps {
  onSyncComplete?: () => void;
}

export function GoogleCalendarConnect({ onSyncComplete }: GoogleCalendarConnectProps) {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('speaker_id', session.user.id)
        .eq('provider', 'google')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching connection:', error);
      }
      setConnection(data as CalendarConnection | null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnection();

    // Listen for OAuth callback messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'google-calendar-connected') {
        toast.success(`Connected to ${event.data.email}`);
        setConnecting(false);
        fetchConnection();
      } else if (event.data.type === 'google-calendar-error') {
        toast.error(`Connection failed: ${event.data.error}`);
        setConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchConnection]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        setConnecting(false);
        return;
      }

      // Make a GET request with action param
      const { data, error } = await supabase.functions.invoke('google-calendar-auth?action=get-auth-url', {
        method: 'GET',
      });

      if (error) throw error;

      // Open popup for OAuth
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        data.url,
        'google-calendar-auth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );
    } catch (error) {
      console.error('Connect error:', error);
      toast.error('Failed to start connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('google-calendar-auth?action=disconnect', {
        method: 'POST',
      });

      if (error) throw error;

      toast.success('Disconnected from Google Calendar');
      setConnection(null);
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { action: 'full-sync' },
      });

      if (error) throw error;

      const messages: string[] = [];
      if (data.pushed?.created > 0) messages.push(`${data.pushed.created} events pushed`);
      if (data.pulled?.imported > 0) messages.push(`${data.pulled.imported} events imported`);
      
      if (messages.length > 0) {
        toast.success(`Sync complete: ${messages.join(', ')}`);
      } else {
        toast.success('Calendar is up to date');
      }

      if (data.errors?.length > 0) {
        data.errors.forEach((err: string) => toast.error(err));
      }

      fetchConnection();
      onSyncComplete?.();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSettingChange = async (setting: 'auto_sync_speaking' | 'show_external_events', value: boolean) => {
    if (!connection) return;

    const { error } = await supabase
      .from('calendar_connections')
      .update({ [setting]: value })
      .eq('id', connection.id);

    if (error) {
      toast.error('Failed to update setting');
    } else {
      setConnection({ ...connection, [setting]: value });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GoogleCalendarIcon className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Sync your speaking events with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection?.is_active ? (
          <>
            {/* Connected State */}
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Connected</span>
                <span className="text-sm text-green-600">{connection.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Sync Status */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {connection.last_sync_at ? (
                  <>Last synced {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })}</>
                ) : (
                  <>Never synced</>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
            </div>

            {/* Sync Errors */}
            {connection.sync_errors?.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Sync Issues</span>
                </div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {connection.sync_errors.slice(0, 3).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync" className="text-sm font-medium">
                    Auto-sync speaking events
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically push speaking engagements to Google Calendar
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={connection.auto_sync_speaking}
                  onCheckedChange={(checked) => handleSettingChange('auto_sync_speaking', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-external" className="text-sm font-medium">
                    Show Google Calendar events
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Import events from Google Calendar (read-only)
                  </p>
                </div>
                <Switch
                  id="show-external"
                  checked={connection.show_external_events}
                  onCheckedChange={(checked) => handleSettingChange('show_external_events', checked)}
                />
              </div>
            </div>
          </>
        ) : (
          /* Disconnected State */
          <div className="text-center py-4">
            <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Google Calendar to sync speaking events and see your schedule in one place.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="gap-2"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Connect Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
