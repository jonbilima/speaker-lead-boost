import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Copy, Link } from "lucide-react";

interface RequestTestimonialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSent: () => void;
}

export function RequestTestimonialDialog({ open, onOpenChange, onRequestSent }: RequestTestimonialDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [eventName, setEventName] = useState("");
  const [message, setMessage] = useState(
    `Hi {name},

I hope this message finds you well! I wanted to thank you again for having me speak at {event}.

If you have a moment, I would greatly appreciate it if you could share a brief testimonial about your experience. It would really help me in connecting with other event organizers.

I've set up a simple form that should take just a couple of minutes:
{link}

Thank you so much for your time and support!

Best regards`
  );
  const [sending, setSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleGenerateLink = async () => {
    if (!eventName.trim()) {
      toast.error("Please enter the event name");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const token = generateToken();

      // Create a placeholder testimonial record with the token
      const { error } = await supabase
        .from('testimonials')
        .insert({
          speaker_id: session.user.id,
          quote: '',
          author_name: recipientName || 'Pending',
          author_email: recipientEmail || null,
          event_name: eventName,
          source: 'requested',
          request_token: token,
          request_sent_at: new Date().toISOString(),
        });

      if (error) throw error;

      const link = `${window.location.origin}/testimonial/${token}`;
      setGeneratedLink(link);
      toast.success("Request link generated!");
    } catch (error: any) {
      console.error('Generate link error:', error);
      toast.error(error.message || "Failed to generate link");
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleCopyMessage = () => {
    if (!generatedLink) return;
    
    const personalizedMessage = message
      .replace('{name}', recipientName || 'there')
      .replace('{event}', eventName)
      .replace('{link}', generatedLink);
    
    navigator.clipboard.writeText(personalizedMessage);
    toast.success("Message copied to clipboard!");
  };

  const handleSendEmail = () => {
    if (!recipientEmail || !generatedLink) return;
    
    const personalizedMessage = message
      .replace('{name}', recipientName || 'there')
      .replace('{event}', eventName)
      .replace('{link}', generatedLink);
    
    const subject = encodeURIComponent(`Would you share a testimonial about ${eventName}?`);
    const body = encodeURIComponent(personalizedMessage);
    
    window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    
    onRequestSent();
    onOpenChange(false);
  };

  const handleClose = () => {
    setRecipientEmail("");
    setRecipientName("");
    setEventName("");
    setGeneratedLink(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Testimonial</DialogTitle>
          <DialogDescription>
            Send a personalized request to an attendee or organizer for a testimonial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name</Label>
              <Input
                id="recipientName"
                placeholder="Sarah Chen"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="sarah@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventName">Event Name *</Label>
            <Input
              id="eventName"
              placeholder="TechConnect Summit 2026"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>

          {!generatedLink ? (
            <Button onClick={handleGenerateLink} className="w-full">
              <Link className="h-4 w-4 mr-2" />
              Generate Request Link
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Request Link</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="bg-muted" />
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message Template</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {'{name}'}, {'{event}'}, {'{link}'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopyMessage} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message
                </Button>
                {recipientEmail && (
                  <Button onClick={handleSendEmail} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Open in Email
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
