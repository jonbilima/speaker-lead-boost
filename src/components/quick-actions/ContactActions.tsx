import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mail, Phone, Plus } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

interface ContactActionsProps {
  contact: Contact;
  onEmail?: (contact: Contact) => void;
  onLogCall?: (contact: Contact) => void;
  onCreateOpportunity?: (contact: Contact) => void;
}

export function ContactActions({
  contact,
  onEmail,
  onLogCall,
  onCreateOpportunity,
}: ContactActionsProps) {
  const handleEmail = () => {
    if (onEmail) {
      onEmail(contact);
      return;
    }

    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {contact.email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleEmail();
              }}
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send Email</p>
          </TooltipContent>
        </Tooltip>
      )}

      {onLogCall && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onLogCall(contact);
              }}
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Log Call</p>
          </TooltipContent>
        </Tooltip>
      )}

      {onCreateOpportunity && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCreateOpportunity(contact);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create Opportunity</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
