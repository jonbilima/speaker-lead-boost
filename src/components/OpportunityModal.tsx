import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, Sparkles, CheckCircle2, FileText } from "lucide-react";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
interface Opportunity {
  id: string;
  event_name: string;
  organizer_name: string | null;
  organizer_email: string | null;
  description: string | null;
  deadline: string | null;
  fee_estimate_min: number | null;
  fee_estimate_max: number | null;
  event_date: string | null;
  location: string | null;
  audience_size: number | null;
  event_url: string | null;
  ai_score: number;
  ai_reason: string | null;
  topics: string[];
}

interface Pitch {
  id: string;
  subject_line: string;
  email_body: string;
  variant: string;
}

interface OpportunityModalProps {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

export const OpportunityModal = ({ opportunity, open, onOpenChange, onApplied }: OpportunityModalProps) => {
  const [generating, setGenerating] = useState(false);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [editedPitches, setEditedPitches] = useState<Record<string, Pitch>>({});
  const [applying, setApplying] = useState(false);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [speakerData, setSpeakerData] = useState<{ name?: string; topics?: string[]; fee_min?: number; fee_max?: number }>({});

  // Load speaker profile data for template filling
  useEffect(() => {
    const loadSpeakerData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, fee_range_min, fee_range_max')
        .eq('id', session.user.id)
        .single();
      
      const { data: userTopics } = await supabase
        .from('user_topics')
        .select('topics(name)')
        .eq('user_id', session.user.id);
      
      if (profile) {
        interface UserTopicRow {
          topics: { name: string } | null;
        }
        setSpeakerData({
          name: profile.name || undefined,
          topics: (userTopics as UserTopicRow[] | null)?.map((ut) => ut.topics?.name).filter((n): n is string => Boolean(n)) || [],
          fee_min: profile.fee_range_min || undefined,
          fee_max: profile.fee_range_max || undefined,
        });
      }
    };
    
    if (open) {
      loadSpeakerData();
    }
  }, [open]);

  if (!opportunity) return null;

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return "No deadline";
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "Passed";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `${days} days left`;
    if (days < 30) return `${Math.floor(days / 7)} weeks left`;
    return `${Math.floor(days / 30)} months left`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  };

  const handleGeneratePitch = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pitch', {
        body: { opportunity_id: opportunity.id }
      });

      if (error) throw error;

      if (data?.pitches) {
        setPitches(data.pitches);
        const initialEdited = data.pitches.reduce((acc: Record<string, Pitch>, pitch: Pitch) => {
          acc[pitch.id] = pitch;
          return acc;
        }, {});
        setEditedPitches(initialEdited);
        toast.success("Generated 3 pitch variants for you!");
      }
    } catch (error) {
      console.error('Generate pitch error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate pitch";
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handlePitchEdit = (pitchId: string, field: 'subject_line' | 'email_body', value: string) => {
    setEditedPitches(prev => ({
      ...prev,
      [pitchId]: {
        ...prev[pitchId],
        [field]: value
      }
    }));
  };

  const handleSavePitch = async (pitchId: string) => {
    try {
      const pitch = editedPitches[pitchId];
      const { error } = await supabase
        .from('pitches')
        .update({
          subject_line: pitch.subject_line,
          email_body: pitch.email_body,
          edited: true
        })
        .eq('id', pitchId);

      if (error) throw error;
      toast.success("Pitch saved!");
    } catch (error) {
      console.error('Save pitch error:', error);
      toast.error("Failed to save pitch");
    }
  };

  const handleMarkApplied = async () => {
    setApplying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('applied_logs')
        .insert({
          user_id: session.user.id,
          opportunity_id: opportunity.id,
          status: 'applied'
        });

      if (error) throw error;

      toast.success("Marked as applied!");
      onApplied?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Mark applied error:', error);
      toast.error("Failed to mark as applied");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{opportunity.event_name}</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-2xl font-bold ${getScoreColor(opportunity.ai_score)}`}>
                {opportunity.ai_score}
              </span>
              <span className="text-sm">AI Match Score</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Details Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {opportunity.topics.map((topic, i) => (
                <Badge key={i} variant="secondary">{topic}</Badge>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {opportunity.organizer_name && (
                <div>
                  <span className="font-semibold">Organizer:</span> {opportunity.organizer_name}
                </div>
              )}
              {opportunity.location && (
                <div>
                  <span className="font-semibold">Location:</span> {opportunity.location}
                </div>
              )}
              {opportunity.deadline && (
                <div>
                  <span className="font-semibold">Deadline:</span> {formatDeadline(opportunity.deadline)}
                </div>
              )}
              {opportunity.fee_estimate_min && opportunity.fee_estimate_max && (
                <div>
                  <span className="font-semibold">Fee:</span> ${opportunity.fee_estimate_min.toLocaleString()} - ${opportunity.fee_estimate_max.toLocaleString()}
                </div>
              )}
              {opportunity.audience_size && (
                <div>
                  <span className="font-semibold">Audience:</span> {opportunity.audience_size.toLocaleString()} people
                </div>
              )}
              {opportunity.event_date && (
                <div>
                  <span className="font-semibold">Event Date:</span> {new Date(opportunity.event_date).toLocaleDateString()}
                </div>
              )}
            </div>

            {opportunity.description && (
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{opportunity.description}</p>
              </div>
            )}

            {opportunity.ai_reason && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Why This Matches You</h4>
                <p className="text-sm">{opportunity.ai_reason}</p>
              </div>
            )}

            <div className="flex gap-2">
              {opportunity.event_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={opportunity.event_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Event
                  </a>
                </Button>
              )}
              {opportunity.organizer_email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${opportunity.organizer_email}`}>
                    Email Organizer
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Pitch Generator Section */}
          <div className="border-t pt-6">
            {pitches.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-semibold mb-2">Create Your Pitch</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start from a template or let AI generate pitches for you
                  </p>
                </div>
                
                {/* Template Selector */}
                <div className="max-w-md mx-auto space-y-4">
                  <TemplateSelector
                    onSelect={(template, subject, body) => {
                      if (template) {
                        setTemplateSubject(subject);
                        setTemplateBody(body);
                        setShowTemplatePreview(true);
                      } else {
                        setShowTemplatePreview(false);
                        setTemplateSubject("");
                        setTemplateBody("");
                      }
                    }}
                    eventData={{
                      event_name: opportunity.event_name,
                      organizer_name: opportunity.organizer_name || undefined,
                      event_date: opportunity.event_date || undefined,
                    }}
                    speakerData={speakerData}
                  />
                  
                  {showTemplatePreview && (
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-left">
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <Input
                          value={templateSubject}
                          onChange={(e) => setTemplateSubject(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Body</Label>
                        <Textarea
                          value={templateBody}
                          onChange={(e) => setTemplateBody(e.target.value)}
                          rows={8}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(`Subject: ${templateSubject}\n\n${templateBody}`)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (opportunity.organizer_email) {
                              window.location.href = `mailto:${opportunity.organizer_email}?subject=${encodeURIComponent(templateSubject)}&body=${encodeURIComponent(templateBody)}`;
                            }
                          }}
                          disabled={!opportunity.organizer_email}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Open in Email
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  
                  <Button onClick={handleGeneratePitch} disabled={generating} className="w-full">
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generating ? "Generating..." : "Generate AI Pitches"}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-4">Your Pitch Variants</h3>
                <Tabs defaultValue={pitches[0]?.id}>
                  <TabsList className="grid w-full grid-cols-3">
                    {pitches.map((pitch, i) => (
                      <TabsTrigger key={pitch.id} value={pitch.id}>
                        {pitch.variant || `Variant ${i + 1}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {pitches.map((pitch) => (
                    <TabsContent key={pitch.id} value={pitch.id} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${pitch.id}`}>Subject Line</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`subject-${pitch.id}`}
                            value={editedPitches[pitch.id]?.subject_line || pitch.subject_line}
                            onChange={(e) => handlePitchEdit(pitch.id, 'subject_line', e.target.value)}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCopy(editedPitches[pitch.id]?.subject_line || pitch.subject_line)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`body-${pitch.id}`}>Email Body</Label>
                        <div className="space-y-2">
                          <Textarea
                            id={`body-${pitch.id}`}
                            value={editedPitches[pitch.id]?.email_body || pitch.email_body}
                            onChange={(e) => handlePitchEdit(pitch.id, 'email_body', e.target.value)}
                            rows={12}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleCopy(editedPitches[pitch.id]?.email_body || pitch.email_body)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleSavePitch(pitch.id)}
                            >
                              Save Edits
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Word count: {(editedPitches[pitch.id]?.email_body || pitch.email_body).split(/\s+/).length}
                      </p>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t pt-6 flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleMarkApplied} disabled={applying}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {applying ? "Marking..." : "Mark as Applied"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
