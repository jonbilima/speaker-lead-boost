import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Link2, Loader2, Mail } from "lucide-react";

// Google icon SVG component
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

interface ConnectedProvider {
  provider: string;
  email: string | null;
  connected: boolean;
}

export function ConnectedAccountsSection() {
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchConnectedProviders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check identities for OAuth providers
      const identities = user.identities || [];
      const googleIdentity = identities.find(i => i.provider === 'google');
      
      // Check if user has password (email provider)
      const hasEmailProvider = identities.some(i => i.provider === 'email');

      setProviders([
        {
          provider: 'email',
          email: hasEmailProvider ? user.email : null,
          connected: hasEmailProvider,
        },
        {
          provider: 'google',
          email: googleIdentity?.identity_data?.email || null,
          connected: !!googleIdentity,
        },
      ]);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedProviders();
  }, []);

  const handleConnectGoogle = async () => {
    setConnecting('google');
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/profile',
        },
      });

      if (error) {
        if (error.message.includes('already linked')) {
          toast.error("This Google account is already connected to another user");
        } else {
          toast.error(error.message);
        }
        setConnecting(null);
      }
    } catch (error) {
      toast.error("Failed to connect Google account");
      setConnecting(null);
    }
  };

  const connectedCount = providers.filter(p => p.connected).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Manage your sign-in methods. You can use any connected account to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Provider */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Email & Password</p>
              {providers.find(p => p.provider === 'email')?.email && (
                <p className="text-sm text-muted-foreground">
                  {providers.find(p => p.provider === 'email')?.email}
                </p>
              )}
            </div>
          </div>
          {providers.find(p => p.provider === 'email')?.connected ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
        </div>

        {/* Google Provider */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <GoogleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Google</p>
              {providers.find(p => p.provider === 'google')?.email && (
                <p className="text-sm text-muted-foreground">
                  {providers.find(p => p.provider === 'google')?.email}
                </p>
              )}
            </div>
          </div>
          {providers.find(p => p.provider === 'google')?.connected ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectGoogle}
              disabled={connecting === 'google'}
            >
              {connecting === 'google' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>

        {connectedCount === 1 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Connect additional accounts for backup sign-in options
          </p>
        )}
      </CardContent>
    </Card>
  );
}
