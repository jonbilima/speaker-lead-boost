import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Copy, Check, Save, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CallPrepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityContext?: {
    scoreId?: string;
    eventName?: string;
    organizerName?: string;
    organizerEmail?: string;
    organization?: string;
  } | null;
}

const preCallChecklist = [
  { id: "research", label: "Researched the organization" },
  { id: "decision_maker", label: "Identified decision maker" },
  { id: "past_events", label: "Reviewed their past events" },
  { id: "talking_points", label: "Prepared custom talking points" },
  { id: "fee_ready", label: "Have my fee range ready" },
];

const callScripts = {
  cold: {
    opening: `"Hi {organizer_name}, this is {speaker_name}. I know you're busy, so I'll be brief..."`,
    introduction: `"I'm a professional speaker who specializes in {speaker_topic}. I've spoken at events like [notable event] and helped audiences with [specific outcome]."`,
    reason: `"I came across {event_name} and was genuinely impressed by the focus on {event_theme}. I believe my expertise could add real value to your attendees."`,
  },
  warm: {
    opening: `"Hi {organizer_name}, we connected [where/when]. I hope you're doing well!"`,
    introduction: `"As you may recall, I'm a speaker focusing on {speaker_topic}. I've been thinking about {event_name} since we last spoke."`,
    reason: `"I wanted to follow up because I think there's a great alignment between what I offer and what your audience is looking for."`,
  },
  referral: {
    opening: `"Hi {organizer_name}, my name is {speaker_name}. {referral_name} suggested I reach out to you..."`,
    introduction: `"{referral_name} mentioned that you're looking for speakers on {speaker_topic}, which happens to be my specialty."`,
    reason: `"Based on what {referral_name} shared about {event_name}, I'd love to explore if I might be a good fit for your program."`,
  },
};

const discoveryQuestions = {
  budget: {
    title: "Budget & Fees",
    questions: [
      "What budget range has been allocated for speakers?",
      "Have you worked with professional speakers before?",
      "Is there flexibility for the right speaker?",
      "What does your typical speaker compensation look like?",
    ],
  },
  timeline: {
    title: "Timeline & Process",
    questions: [
      "When is the event scheduled?",
      "When do you need to finalize your speaker?",
      "Who else is involved in this decision?",
      "What's your typical evaluation process?",
    ],
  },
  event: {
    title: "Event Details",
    questions: [
      "Tell me about the event theme and format",
      "How does the speaker session fit in the agenda?",
      "What time slot are you considering?",
      "Is it in-person, virtual, or hybrid?",
    ],
  },
  audience: {
    title: "Audience",
    questions: [
      "Who will be in the audience?",
      "What's their biggest challenge right now?",
      "What should they think, feel, or do after the session?",
      "What's the expected attendance?",
    ],
  },
};

const objectionHandlers = [
  {
    objection: "We don't have budget",
    response: `"I understand budget is a consideration. Many organizations find that the ROI from a powerful keynote far exceeds the investment. Could we explore what outcomes would make this worthwhile for you? I'm also flexible on format - perhaps a shorter session or virtual option might work with your current constraints."`,
  },
  {
    objection: "We already have a speaker",
    response: `"That's great that you're already planning ahead! I'd love to stay connected for future events. Could you tell me a bit about your speaker lineup this year? I might be a good fit for a different session or next year's event. Also, would it be helpful if I shared my materials in case anything changes?"`,
  },
  {
    objection: "Send me information",
    response: `"I'd be happy to send you my speaker kit. Before I do, let me make sure I send you the most relevant materials. What topics are most important to your audience this year? And what's the best email to reach you at? I'll follow up in a few days to answer any questions."`,
  },
  {
    objection: "The decision maker isn't available",
    response: `"I completely understand. Could you help me understand the best way to connect with them? Is there a specific time that works better, or would an email introduction be more appropriate? I'd also love to hear your perspective on what they typically look for in speakers."`,
  },
];

export function CallPrepDialog({ open, onOpenChange, opportunityContext }: CallPrepDialogProps) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [scriptTab, setScriptTab] = useState("cold");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string>("");
  const [nextStepDate, setNextStepDate] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    budget: true,
    timeline: true,
    event: true,
    audience: true,
  });
  const [saving, setSaving] = useState(false);

  const fillTokens = (text: string) => {
    if (!opportunityContext) return text;
    return text
      .replace(/{organizer_name}/g, opportunityContext.organizerName || "[Organizer]")
      .replace(/{organization}/g, opportunityContext.organization || "[Organization]")
      .replace(/{event_name}/g, opportunityContext.eventName || "[Event]")
      .replace(/{speaker_name}/g, "[Your Name]")
      .replace(/{speaker_topic}/g, "[Your Topic]")
      .replace(/{referral_name}/g, "[Referral Name]")
      .replace(/{event_theme}/g, "[Event Theme]");
  };

  const handleCopy = async (text: string, id: string) => {
    const filledText = fillTokens(text);
    await navigator.clipboard.writeText(filledText);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSaveAndUpdate = async () => {
    if (!opportunityContext?.scoreId) {
      toast.error("No opportunity context available");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Log the call as an activity
      const { error: activityError } = await supabase.from("outreach_activities").insert({
        match_id: opportunityContext.scoreId,
        speaker_id: session.user.id,
        activity_type: "call",
        notes: `Call Notes:\n${notes}\n\nOutcome: ${outcome}\n\nDiscovery Answers:\n${Object.entries(answers)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`,
        follow_up_date: nextStepDate || null,
      });

      if (activityError) throw activityError;

      // Update pipeline stage if outcome is "booked"
      if (outcome === "booked") {
        await supabase
          .from("opportunity_scores")
          .update({ pipeline_stage: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", opportunityContext.scoreId);
      } else if (outcome === "interested") {
        await supabase
          .from("opportunity_scores")
          .update({ pipeline_stage: "negotiating" })
          .eq("id", opportunityContext.scoreId);
      }

      toast.success("Call logged successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving call notes:", error);
      toast.error("Failed to save call notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📞 Call Prep
            {opportunityContext?.eventName && (
              <Badge variant="secondary" className="ml-2">
                {opportunityContext.eventName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Pre-Call Checklist */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                ✅ Pre-Call Checklist
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {preCallChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      id={item.id}
                      checked={checklist[item.id] || false}
                      onCheckedChange={(checked) =>
                        setChecklist((prev) => ({ ...prev, [item.id]: !!checked }))
                      }
                    />
                    <Label htmlFor={item.id} className="text-sm cursor-pointer">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Opening Scripts */}
            <div className="space-y-3">
              <h3 className="font-semibold">📝 Opening Scripts</h3>
              <Tabs value={scriptTab} onValueChange={setScriptTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="cold">Cold Call</TabsTrigger>
                  <TabsTrigger value="warm">Warm Call</TabsTrigger>
                  <TabsTrigger value="referral">Referral</TabsTrigger>
                </TabsList>
                {Object.entries(callScripts).map(([key, script]) => (
                  <TabsContent key={key} value={key} className="space-y-3 mt-4">
                    {Object.entries(script).map(([section, text]) => (
                      <div key={section} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase text-muted-foreground">
                            {section.replace("_", " ")}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleCopy(text, `${key}-${section}`)}
                          >
                            {copiedId === `${key}-${section}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-sm bg-muted/50 p-3 rounded-md">
                          {fillTokens(text)}
                        </p>
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* Discovery Questions */}
            <div className="space-y-3">
              <h3 className="font-semibold">🔍 Discovery Questions</h3>
              <div className="space-y-2">
                {Object.entries(discoveryQuestions).map(([key, section]) => (
                  <Collapsible
                    key={key}
                    open={expandedSections[key]}
                    onOpenChange={() => toggleSection(key)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto"
                      >
                        <span className="font-medium">{section.title}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedSections[key] ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 space-y-3">
                      {section.questions.map((question, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-sm text-primary">•</span>
                            <span className="text-sm flex-1">{question}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 shrink-0"
                              onClick={() => handleCopy(question, `q-${key}-${idx}`)}
                            >
                              {copiedId === `q-${key}-${idx}` ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <Input
                            placeholder="Capture answer..."
                            value={answers[`${key}-${idx}`] || ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [`${key}-${idx}`]: e.target.value,
                              }))
                            }
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>

            {/* Objection Handlers */}
            <div className="space-y-3">
              <h3 className="font-semibold">🛡️ Objection Handlers</h3>
              <div className="space-y-3">
                {objectionHandlers.map((handler, idx) => (
                  <Collapsible key={idx}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between p-3 h-auto text-left"
                      >
                        <span className="text-sm font-medium text-destructive">
                          "{handler.objection}"
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 bg-muted/30 rounded-b-md border-x border-b">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">{handler.response}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 shrink-0"
                          onClick={() => handleCopy(handler.response, `obj-${idx}`)}
                        >
                          {copiedId === `obj-${idx}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>

            {/* After the Call */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">📋 After the Call</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Quick Notes</Label>
                  <Textarea
                    placeholder="Key takeaways from the call..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Outcome</Label>
                    <Select value={outcome} onValueChange={setOutcome}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="follow_up">Need to follow up</SelectItem>
                        <SelectItem value="not_fit">Not a fit</SelectItem>
                        <SelectItem value="booked">Booked!</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Step Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={nextStepDate}
                        onChange={(e) => setNextStepDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                {opportunityContext?.scoreId && (
                  <Button
                    onClick={handleSaveAndUpdate}
                    disabled={saving}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save & Update Opportunity"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
