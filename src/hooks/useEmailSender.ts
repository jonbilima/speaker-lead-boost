import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  replyTo?: string;
  bcc?: string | string[];
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type?: string;
  }>;
  relatedType?: "pitch" | "follow_up" | "invoice" | "feedback" | "other";
  relatedId?: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  testMode?: boolean;
}

export function useEmailSender() {
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: options,
      });

      if (error) {
        toast({
          title: "Email Failed",
          description: error.message || "Failed to send email",
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      if (data.testMode) {
        toast({
          title: "Test Mode",
          description: "Email sent in test mode. Configure a verified domain for production.",
        });
      } else if (data.success) {
        toast({
          title: "Email Sent",
          description: "Your email was sent successfully",
        });
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      toast({
        title: "Email Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsSending(false);
    }
  };

  return { sendEmail, isSending };
}
