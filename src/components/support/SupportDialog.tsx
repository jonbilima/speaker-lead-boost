import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2, LifeBuoy, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPPORT_EMAIL = "support@nextmic.ai";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setCategory("general");
    setSubject("");
    setMessage("");
  };

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject || "NextMic support request",
  )}&body=${encodeURIComponent(message)}`;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Add a subject and a message so we can help.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-support-request", {
        body: {
          category,
          subject: subject.trim(),
          message: message.trim(),
          pageUrl: window.location.href,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to send");
      }

      toast.success("Support request sent — we'll reply by email shortly.");
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Support request failed:", err);
      toast.error("We couldn't send that automatically.", {
        description: `Email us at ${SUPPORT_EMAIL} instead.`,
        action: {
          label: "Copy email",
          onClick: () => {
            navigator.clipboard.writeText(SUPPORT_EMAIL);
            toast.success("Email address copied");
          },
        },
        duration: 10000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Contact Support
          </DialogTitle>
          <DialogDescription>
            Tell us what's happening and we'll reply to your account email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="support-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General question</SelectItem>
                <SelectItem value="bug">Something is broken</SelectItem>
                <SelectItem value="billing">Billing or membership</SelectItem>
                <SelectItem value="data">Opportunity or data issue</SelectItem>
                <SelectItem value="feature">Feature request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened, and what did you expect?"
              rows={6}
              maxLength={5000}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Prefer email? {SUPPORT_EMAIL}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => {
                navigator.clipboard.writeText(SUPPORT_EMAIL);
                toast.success("Email address copied");
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href={mailtoHref}>Use email client</a>
          </Button>
          <Button onClick={handleSubmit} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {sending ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
