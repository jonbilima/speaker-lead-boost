import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  HelpCircle,
  Lightbulb,
  FileText,
  DollarSign,
  Shield,
  Target,
  Sparkles,
} from "lucide-react";

interface QuickStartMode {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
  color: string;
}

const QUICK_START_MODES: QuickStartMode[] = [
  {
    id: "review-pitch",
    label: "Review My Pitch",
    description: "Get feedback on your pitch email",
    icon: <Mail className="h-5 w-5" />,
    prompt: "I'd like you to review my pitch email. Here it is:\n\n[Paste your pitch here]",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  {
    id: "practice-qa",
    label: "Practice Q&A",
    description: "Roleplay with a skeptical organizer",
    icon: <HelpCircle className="h-5 w-5" />,
    prompt: "I want to practice answering tough questions from event organizers. Please act as a skeptical organizer and interview me about my speaking services.",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  {
    id: "brainstorm-titles",
    label: "Brainstorm Titles",
    description: "Get creative talk title ideas",
    icon: <Lightbulb className="h-5 w-5" />,
    prompt: "Help me brainstorm talk titles. My topic is:\n\n[Describe your topic]\n\nTarget audience:\n\n[Describe audience]",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  {
    id: "optimize-bio",
    label: "Optimize My Bio",
    description: "Get versions at 50, 100, 150, 200 words",
    icon: <FileText className="h-5 w-5" />,
    prompt: "Please optimize my speaker bio and give me versions at different lengths. Here's my current bio:\n\n[Paste your bio here]",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  {
    id: "negotiate-fee",
    label: "Negotiate My Fee",
    description: "Roleplay fee negotiations",
    icon: <DollarSign className="h-5 w-5" />,
    prompt: "I want to practice negotiating my speaking fee. Please act as an event organizer and let's roleplay a fee negotiation. Start by telling me about your event and making an initial offer.",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    id: "improve-description",
    label: "Improve Description",
    description: "Enhance your talk abstract",
    icon: <Target className="h-5 w-5" />,
    prompt: "Please help me improve my talk description/abstract. Here it is:\n\n[Paste your abstract here]",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  {
    id: "handle-objections",
    label: "Handle Objections",
    description: "Practice responding to concerns",
    icon: <Shield className="h-5 w-5" />,
    prompt: "I want to practice handling common objections from event organizers. Please present objections one at a time and give me feedback on my responses.",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
];

interface CoachQuickStartProps {
  onSelect: (mode: string, prompt: string) => void;
}

export function CoachQuickStart({ onSelect }: CoachQuickStartProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-8 w-8 text-violet-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
        <p className="text-muted-foreground max-w-md">
          Choose a coaching mode below or start a free-form conversation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl w-full">
        {QUICK_START_MODES.map((mode) => (
          <Card
            key={mode.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => onSelect(mode.id, mode.prompt)}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${mode.color}`}>
                {mode.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium group-hover:text-violet-600 transition-colors">
                  {mode.label}
                </h3>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
