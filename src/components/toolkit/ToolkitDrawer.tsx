import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FileText,
  Phone,
  Mic,
  FolderOpen,
  Send,
  MessageSquare,
  ChevronRight,
  User,
  Target,
  PenTool,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { PitchGeneratorDialog } from "./PitchGeneratorDialog";
import { CallPrepDialog } from "./CallPrepDialog";
import { SendPackageDialog } from "./SendPackageDialog";

interface ToolkitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityContext?: {
    scoreId?: string;
    eventName?: string;
    organizerName?: string;
    organizerEmail?: string;
    organization?: string;
    opportunityId?: string;
  } | null;
}

const toolkitItems = [
  {
    id: "generate-pitch",
    title: "Generate Pitch",
    description: "AI-powered pitch for any opportunity",
    icon: Sparkles,
    action: "modal",
  },
  {
    id: "call-prep",
    title: "Call Prep",
    description: "Scripts, discovery questions & objection handlers",
    icon: Phone,
    action: "modal",
  },
  {
    id: "email-templates",
    title: "Email Templates",
    description: "Ready-to-use email templates",
    icon: FileText,
    action: "navigate",
    url: "/templates",
  },
  {
    id: "speeches",
    title: "Speech Studio",
    description: "AI-powered speech writing & practice",
    icon: PenTool,
    action: "navigate",
    url: "/speeches",
  },
  {
    id: "performance",
    title: "Performance",
    description: "Feedback collection & analytics",
    icon: BarChart3,
    action: "navigate",
    url: "/performance",
  },
  {
    id: "ai-coach",
    title: "AI Coach",
    description: "Get coaching on your speaking",
    icon: Mic,
    action: "navigate",
    url: "/coach",
  },
  {
    id: "my-assets",
    title: "My Assets",
    description: "Photos, videos, one-sheets",
    icon: FolderOpen,
    action: "navigate",
    url: "/assets",
  },
  {
    id: "send-package",
    title: "Send Package",
    description: "Create speaker package",
    icon: Send,
    action: "modal",
  },
  {
    id: "request-feedback",
    title: "Request Feedback",
    description: "Get testimonials from clients",
    icon: MessageSquare,
    action: "navigate",
    url: "/assets?tab=testimonials",
  },
  {
    id: "topics",
    title: "Manage Topics",
    description: "Update your speaking topics",
    icon: Target,
    action: "navigate",
    url: "/topics",
  },
  {
    id: "profile",
    title: "My Profile",
    description: "Update your speaker profile",
    icon: User,
    action: "navigate",
    url: "/profile",
  },
];

export function ToolkitDrawer({ open, onOpenChange, opportunityContext }: ToolkitDrawerProps) {
  const navigate = useNavigate();
  const [pitchDialogOpen, setPitchDialogOpen] = useState(false);
  const [callPrepOpen, setCallPrepOpen] = useState(false);
  const [sendPackageOpen, setSendPackageOpen] = useState(false);

  const handleItemClick = (item: typeof toolkitItems[0]) => {
    if (item.action === "navigate" && item.url) {
      navigate(item.url);
      onOpenChange(false);
    } else if (item.action === "modal") {
      if (item.id === "generate-pitch") {
        setPitchDialogOpen(true);
      } else if (item.id === "call-prep") {
        setCallPrepOpen(true);
      } else if (item.id === "send-package") {
        setSendPackageOpen(true);
      }
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <span className="text-2xl">⚡</span>
              Toolkit
              {opportunityContext?.eventName && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  • {opportunityContext.eventName}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-2">
            {toolkitItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-start h-auto py-4 px-4 hover:bg-muted group"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <PitchGeneratorDialog
        open={pitchDialogOpen}
        onOpenChange={setPitchDialogOpen}
        opportunityId={opportunityContext?.opportunityId}
      />

      <CallPrepDialog
        open={callPrepOpen}
        onOpenChange={setCallPrepOpen}
        opportunityContext={opportunityContext}
      />

      <SendPackageDialog
        open={sendPackageOpen}
        onOpenChange={setSendPackageOpen}
      />
    </>
  );
}
