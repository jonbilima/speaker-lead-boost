import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface PhoneScriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const discoveryQuestions = [
  {
    category: "Event Details",
    questions: [
      "What is the theme or focus of this year's event?",
      "Who is your target audience and what are their biggest challenges?",
      "What outcomes do you want attendees to walk away with?",
      "How many attendees are you expecting?",
      "Is this a virtual, in-person, or hybrid event?",
    ],
  },
  {
    category: "Speaker Requirements",
    questions: [
      "What speaking format are you looking for? (Keynote, workshop, panel)",
      "How long should the presentation be?",
      "Are there any specific topics you'd like me to address?",
      "Will there be Q&A time included?",
      "Do you need any breakout sessions or workshops?",
    ],
  },
  {
    category: "Logistics & Budget",
    questions: [
      "What is your budget range for speakers?",
      "Do you cover travel and accommodation?",
      "What's your timeline for confirming speakers?",
      "Who else is speaking at the event?",
      "Do you need video recordings or materials in advance?",
    ],
  },
  {
    category: "Follow-up",
    questions: [
      "What's the best way to follow up with you?",
      "When do you need to make a final decision by?",
      "Would it be helpful if I sent over a speaker packet?",
      "Is there anything else you need from me at this stage?",
      "Who else is involved in the decision-making process?",
    ],
  },
];

const callScripts = [
  {
    title: "Initial Outreach Call",
    script: `Hi [Name], this is [Your Name]. I hope I'm not catching you at a bad time.

I'm reaching out because I noticed you're organizing [Event Name] and I specialize in [Your Topics]. I've helped organizations like [Example Client] achieve [Specific Result].

I'd love to learn more about your event and see if there might be a fit. Do you have a few minutes to chat about what you're looking for in a speaker?

[If yes, transition to discovery questions]

[If no] No problem at all. When would be a better time to connect? I'm happy to work around your schedule.`,
  },
  {
    title: "Follow-up After Proposal",
    script: `Hi [Name], this is [Your Name] following up on the speaker proposal I sent over for [Event Name].

I wanted to check in and see if you had any questions about the package or if there's anything I can clarify.

[Pause for response]

I'm also happy to schedule a quick call to discuss how I could customize the presentation specifically for your audience if that would be helpful.

What are the next steps on your end?`,
  },
  {
    title: "Post-Event Thank You",
    script: `Hi [Name], this is [Your Name]. I wanted to personally thank you for having me speak at [Event Name].

I had a wonderful time and the audience was fantastic. I've already received some great feedback.

A couple of things:
1. I'd love to get your feedback on how the session went
2. If you were happy with the presentation, I'd really appreciate a testimonial
3. I'd also love to stay in touch for future events

Would any of that work for you?`,
  },
];

export function PhoneScriptsDialog({
  open,
  onOpenChange,
}: PhoneScriptsDialogProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Phone Scripts & Discovery Questions</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions">Discovery Questions</TabsTrigger>
            <TabsTrigger value="scripts">Call Scripts</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {discoveryQuestions.map((category) => (
                  <Card key={category.category}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{category.category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {category.questions.map((question, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm group"
                          >
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span className="flex-1">{question}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                handleCopy(question, `q-${category.category}-${idx}`)
                              }
                            >
                              {copiedItem === `q-${category.category}-${idx}` ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scripts" className="mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {callScripts.map((script) => (
                  <Card key={script.title}>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">{script.title}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(script.script, `s-${script.title}`)}
                      >
                        {copiedItem === `s-${script.title}` ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground bg-muted/50 p-4 rounded-lg">
                        {script.script}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
