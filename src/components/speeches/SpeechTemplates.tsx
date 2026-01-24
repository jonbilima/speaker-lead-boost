import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout, ArrowRight } from "lucide-react";

interface SpeechTemplatesProps {
  onSelectTemplate: (templateId: string) => void;
}

const TEMPLATES = [
  {
    id: "heros_journey",
    name: "Hero's Journey",
    icon: "🦸",
    description: "Classic storytelling arc - Setup, Conflict, Resolution",
    bestFor: ["Keynotes", "Motivational talks", "Personal stories"],
    structure: [
      "The Ordinary World - Set the scene",
      "The Call to Adventure - The challenge or opportunity",
      "Crossing the Threshold - Taking action",
      "Tests and Challenges - The struggle",
      "The Ordeal - The darkest moment",
      "The Reward - What was learned",
      "The Return - How it applies to audience",
    ],
  },
  {
    id: "problem_solution",
    name: "Problem-Solution-Action",
    icon: "🎯",
    description: "Corporate favorite - Clear, actionable framework",
    bestFor: ["Business presentations", "Sales pitches", "Training"],
    structure: [
      "Hook - Grab attention with the stakes",
      "Problem - Define the pain point clearly",
      "Agitation - Show the cost of inaction",
      "Solution - Present your approach",
      "Evidence - Prove it works",
      "Action - Clear next steps",
    ],
  },
  {
    id: "three_point_sermon",
    name: "3-Point Sermon",
    icon: "✝️",
    description: "Traditional faith-based structure",
    bestFor: ["Sermons", "Inspirational talks", "Teaching"],
    structure: [
      "Opening Prayer/Scripture",
      "Introduction - Connect to audience",
      "Point 1 - Biblical foundation",
      "Point 2 - Practical application",
      "Point 3 - Call to transformation",
      "Invitation/Altar call",
      "Closing benediction",
    ],
  },
  {
    id: "tedx_formula",
    name: "TEDx Formula",
    icon: "💡",
    description: "18-minute format - One idea worth spreading",
    bestFor: ["TED talks", "Conference keynotes", "Thought leadership"],
    structure: [
      "Unexpected Hook - Surprise or challenge",
      "The Idea - One sentence thesis",
      "Story 1 - Personal connection",
      "Evidence - Data or research",
      "Story 2 - External example",
      "Implications - Why it matters",
      "Memorable Close - Callback or call to action",
    ],
  },
  {
    id: "workshop_flow",
    name: "Workshop Flow",
    icon: "🛠️",
    description: "Interactive learning format",
    bestFor: ["Workshops", "Training sessions", "Masterclasses"],
    structure: [
      "Context Setting - Why we're here",
      "Learning Objectives - What they'll gain",
      "Concept 1 - Teach",
      "Activity 1 - Practice",
      "Concept 2 - Teach",
      "Activity 2 - Practice",
      "Integration - Apply to their context",
      "Q&A and Debrief",
      "Next Steps - Homework/resources",
    ],
  },
  {
    id: "past_present_future",
    name: "Past-Present-Future",
    icon: "⏳",
    description: "Show evolution and vision",
    bestFor: ["Company updates", "Industry talks", "Vision casting"],
    structure: [
      "Hook - Where we are today",
      "The Past - How we got here",
      "Lessons Learned - What shaped us",
      "The Present - Current reality",
      "The Challenge - What we face",
      "The Future - Where we're going",
      "The Invitation - Join the journey",
    ],
  },
];

export function SpeechTemplates({ onSelectTemplate }: SpeechTemplatesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Layout className="h-6 w-6" />
          Speech Templates
        </h2>
        <p className="text-muted-foreground">
          Start with a proven structure for your speech type
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex flex-wrap gap-1 mb-4">
                {template.bestFor.map((use) => (
                  <Badge key={use} variant="secondary" className="text-xs">
                    {use}
                  </Badge>
                ))}
              </div>

              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Structure:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1">
                  {template.structure.slice(0, 5).map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary font-medium">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                  {template.structure.length > 5 && (
                    <li className="text-primary">
                      +{template.structure.length - 5} more steps...
                    </li>
                  )}
                </ol>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4 group"
                onClick={() => onSelectTemplate(template.id)}
              >
                Use Template
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
