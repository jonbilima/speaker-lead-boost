import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Mail, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EmailSettingsSectionProps {
  userId: string;
}

export function EmailSettingsSection({ userId }: EmailSettingsSectionProps) {
  const [replyTo, setReplyTo] = useState("");
  const [signature, setSignature] = useState("");
  const [bccSelf, setBccSelf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_reply_to, email_signature, email_bcc_self")
        .eq("id", userId)
        .single();

      if (data) {
        setReplyTo(data.email_reply_to || "");
        setSignature(data.email_signature || "");
        setBccSelf(data.email_bcc_self || false);
      }
    };

    fetchSettings();
  }, [userId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          email_reply_to: replyTo || null,
          email_signature: signature || null,
          email_bcc_self: bccSelf,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your email settings have been updated",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Email Settings</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="replyTo">Reply-To Email Address</Label>
          <Input
            id="replyTo"
            type="email"
            placeholder="Leave blank to use your account email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Responses will be sent to this address
          </p>
        </div>

        <div>
          <Label htmlFor="signature">Email Signature</Label>
          <Textarea
            id="signature"
            placeholder="Your professional signature (appended to all outgoing emails)"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={4}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="bccSelf">BCC Yourself on Sent Emails</Label>
            <p className="text-xs text-muted-foreground">
              Receive a copy of every email you send
            </p>
          </div>
          <Switch
            id="bccSelf"
            checked={bccSelf}
            onCheckedChange={setBccSelf}
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Email Settings"}
        </Button>
      </div>
    </Card>
  );
}
