import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Self-serve sign-in email change.
 *
 * The confirmation link goes to the NEW address only — the change does not
 * take effect until it is clicked, so a mistyped address can never lock
 * anyone out. Mail is sent by our own auth-email function (nextmic.ai),
 * not the platform's default sender.
 */
export function ChangeEmailDialog({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const a = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (a.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      toast.error("The two addresses don't match");
      return;
    }
    if (a.toLowerCase() === (currentEmail || "").toLowerCase()) {
      toast.error("That's already your sign-in email");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-email", {
        body: { action: "email_change", email: a },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Confirmation sent to ${a}. Click the link in that email to finish — keep signing in with your current address until then.`);
        setOpen(false);
        setNewEmail("");
        setConfirmEmail("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't start the change. Email support@nextmic.ai.");
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">Change</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change your sign-in email</DialogTitle>
          <DialogDescription>
            We'll send a confirmation link to the new address. Your email
            changes only once you click it — until then, keep signing in with{" "}
            <strong>{currentEmail}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-email">New email</Label>
            <Input id="new-email" type="email" autoComplete="email"
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@yourdomain.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-email">Confirm new email</Label>
            <Input id="confirm-email" type="email" autoComplete="email"
              value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="you@yourdomain.com" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send confirmation link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
