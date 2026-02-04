import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  RefreshCw,
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Lightbulb,
  MessageSquare,
  BookOpen,
  AlertCircle,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SpeechFormData } from "../SpeechWizard";
import type { OutlineSection } from "@/pages/Speeches";

interface SpeechOutlineStepProps {
  formData: SpeechFormData;
  outline: OutlineSection[];
  onOutlineChange: (outline: OutlineSection[]) => void;
  onTitleGenerated: (title: string) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  opening: <Lightbulb className="h-4 w-4" />,
  main_point: <MessageSquare className="h-4 w-4" />,
  story: <BookOpen className="h-4 w-4" />,
  interaction: <MessageSquare className="h-4 w-4" />,
  closing: <Lightbulb className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  opening: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  main_point: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  story: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  interaction: "bg-green-500/10 text-green-600 border-green-500/20",
  closing: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

// Fallback templates when AI generation fails
const FALLBACK_TEMPLATES: Record<string, OutlineSection[]> = {
  standard: [
    { id: "open_1", type: "opening", title: "Hook / Attention Grabber", content: "Start with a compelling story, surprising statistic, or thought-provoking question", estimatedMinutes: 2 },
    { id: "main_1", type: "main_point", title: "Main Point 1", content: "Your first key idea with supporting evidence", estimatedMinutes: 5 },
    { id: "story_1", type: "story", title: "Supporting Story", content: "A personal or illustrative story that reinforces your first point", estimatedMinutes: 3 },
    { id: "main_2", type: "main_point", title: "Main Point 2", content: "Your second key idea with supporting evidence", estimatedMinutes: 5 },
    { id: "interact_1", type: "interaction", title: "Audience Engagement", content: "Question, poll, or brief exercise to engage the audience", estimatedMinutes: 2 },
    { id: "main_3", type: "main_point", title: "Main Point 3", content: "Your third key idea with supporting evidence", estimatedMinutes: 5 },
    { id: "close_1", type: "closing", title: "Call to Action", content: "Summarize key points and give a clear call to action", estimatedMinutes: 3 },
  ],
  ted: [
    { id: "ted_open", type: "opening", title: "The Unexpected Opening", content: "Start with something surprising that challenges assumptions", estimatedMinutes: 2 },
    { id: "ted_prob", type: "main_point", title: "The Problem", content: "Define the problem or challenge you're addressing", estimatedMinutes: 4 },
    { id: "ted_journey", type: "story", title: "The Journey", content: "Share your personal journey discovering the solution", estimatedMinutes: 5 },
    { id: "ted_insight", type: "main_point", title: "The Key Insight", content: "Reveal the breakthrough idea or principle", estimatedMinutes: 4 },
    { id: "ted_evidence", type: "main_point", title: "The Evidence", content: "Support your insight with data, research, or examples", estimatedMinutes: 4 },
    { id: "ted_vision", type: "closing", title: "The Vision", content: "Paint a picture of the future if we embrace this idea", estimatedMinutes: 3 },
  ],
  keynote: [
    { id: "key_welcome", type: "opening", title: "Welcome & Context Setting", content: "Set the stage and establish your credibility", estimatedMinutes: 3 },
    { id: "key_state", type: "main_point", title: "State of the Industry", content: "Current landscape and challenges we face", estimatedMinutes: 8 },
    { id: "key_case1", type: "story", title: "Case Study 1", content: "Real-world example demonstrating key principles", estimatedMinutes: 5 },
    { id: "key_vision", type: "main_point", title: "The Path Forward", content: "Your vision and recommended approach", estimatedMinutes: 8 },
    { id: "key_qa", type: "interaction", title: "Interactive Discussion", content: "Engage with audience questions and insights", estimatedMinutes: 5 },
    { id: "key_action", type: "main_point", title: "Actionable Takeaways", content: "Specific steps attendees can implement", estimatedMinutes: 5 },
    { id: "key_close", type: "closing", title: "Inspiring Close", content: "End with a memorable, motivating message", estimatedMinutes: 3 },
  ],
};

export function SpeechOutlineStep({
  formData,
  outline,
  onOutlineChange,
  onTitleGenerated,
}: SpeechOutlineStepProps) {
  const [generating, setGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const generateOutline = async (isRetry = false) => {
    setGenerating(true);
    setError(null);
    setErrorType(null);
    
    if (!isRetry) {
      setShowFallback(false);
      setRetryCount(0);
    }
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("generate-speech-content", {
        body: {
          action: "generate_outline",
          params: {
            title: formData.title,
            topic: formData.topic,
            targetAudience: formData.targetAudience,
            durationMinutes: formData.durationMinutes,
            speechType: formData.speechType,
            industryContext: formData.industryContext,
            keyMessage: formData.keyMessage,
            desiredOutcome: formData.desiredOutcome,
            template: formData.selectedTemplate,
          },
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      // Check for error in response
      if (data?.error) {
        const type = data.errorType || "UNKNOWN";
        setErrorType(type);
        
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        if (type === "CONFIG_ERROR") {
          setError("AI service not configured. Please contact support.");
          setShowFallback(true);
        } else if (type === "RATE_LIMIT") {
          setError("Too many requests. Please wait a moment and try again.");
          // Don't show fallback for rate limit - just retry later
        } else if (type === "PAYMENT_REQUIRED") {
          setError("AI credits exhausted. Please add credits to your account.");
          setShowFallback(true);
        } else if (type === "TIMEOUT") {
          setError("Request timed out. Please try again.");
          if (newRetryCount >= 2) setShowFallback(true);
        } else {
          setError(data.error);
          if (newRetryCount >= 2) setShowFallback(true);
        }
        return;
      }

      if (data?.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        onOutlineChange(data.sections);
        setExpandedSections(new Set(data.sections.map((s: OutlineSection) => s.id)));
        setRetryCount(0);
        
        if (data.suggestedTitle && formData.autoGenerateTitle) {
          onTitleGenerated(data.suggestedTitle);
        }
        
        toast({ title: "Outline generated!" });
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (err) {
      console.error("Error generating outline:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate outline";
      setError(errorMessage);
      
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      
      // Show fallback after 2 failed attempts
      if (newRetryCount >= 2) {
        setShowFallback(true);
      }
      
      toast({
        title: "Generation failed",
        description: newRetryCount >= 2 
          ? "AI unavailable. Try a template instead." 
          : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = () => {
    generateOutline(true);
  };

  const useFallbackTemplate = (templateKey: string) => {
    const template = FALLBACK_TEMPLATES[templateKey] || FALLBACK_TEMPLATES.standard;
    
    // Adjust template based on duration
    const scaleFactor = formData.durationMinutes / template.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const scaledTemplate = template.map(section => ({
      ...section,
      id: `${section.id}_${Date.now()}`,
      estimatedMinutes: Math.max(1, Math.round(section.estimatedMinutes * scaleFactor)),
    }));
    
    onOutlineChange(scaledTemplate);
    setExpandedSections(new Set(scaledTemplate.map(s => s.id)));
    setError(null);
    setShowFallback(false);
    toast({ title: "Template applied! Customize it to fit your speech." });
  };

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const updateSection = (id: string, updates: Partial<OutlineSection>) => {
    onOutlineChange(
      outline.map((section) =>
        section.id === id ? { ...section, ...updates } : section
      )
    );
  };

  const deleteSection = (id: string) => {
    onOutlineChange(outline.filter((section) => section.id !== id));
  };

  const addSection = (afterId?: string) => {
    const newSection: OutlineSection = {
      id: `section_${Date.now()}`,
      type: "main_point",
      title: "New Section",
      content: "",
      estimatedMinutes: 5,
    };

    if (afterId) {
      const index = outline.findIndex((s) => s.id === afterId);
      const newOutline = [...outline];
      newOutline.splice(index + 1, 0, newSection);
      onOutlineChange(newOutline);
    } else {
      onOutlineChange([...outline, newSection]);
    }
    setExpandedSections(new Set([...expandedSections, newSection.id]));
  };

  const totalMinutes = outline.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Structure Your Speech</h2>
        <p className="text-muted-foreground mt-2">
          {outline.length === 0
            ? "Generate an AI-powered outline based on your parameters"
            : "Review and customize your speech structure"}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              {errorType !== "CONFIG_ERROR" && errorType !== "PAYMENT_REQUIRED" && (
                <Button variant="outline" size="sm" onClick={handleRetry} disabled={generating}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${generating ? "animate-spin" : ""}`} />
                  Try Again {retryCount > 0 && `(${retryCount})`}
                </Button>
              )}
            </div>
            {retryCount >= 2 && !showFallback && (
              <p className="text-sm opacity-80">
                AI generation is having issues. Consider using a template below.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Fallback Templates */}
      {showFallback && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {retryCount >= 2 ? "AI unavailable. Would you like to use a template instead?" : "Start with a Template Instead?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Choose a pre-built template to get started. You can customize it afterwards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" className="flex-col h-auto py-3" onClick={() => useFallbackTemplate("standard")}>
                <span className="font-medium">3-Point Structure</span>
                <span className="text-xs text-muted-foreground">Intro, 3 points, Conclusion</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-3" onClick={() => useFallbackTemplate("ted")}>
                <span className="font-medium">TED-Style Talk</span>
                <span className="text-xs text-muted-foreground">Problem, Journey, Insight</span>
              </Button>
              <Button variant="outline" className="flex-col h-auto py-3" onClick={() => useFallbackTemplate("keynote")}>
                <span className="font-medium">Keynote Address</span>
                <span className="text-xs text-muted-foreground">State, Vision, Action</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {outline.length === 0 && !showFallback ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {generating ? (
              <div className="space-y-4 w-full max-w-md">
                <p className="text-center text-muted-foreground">
                  Generating your speech outline...
                </p>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <Sparkles className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Create Your Outline</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Based on your parameters, we'll generate a complete speech structure with
                  multiple options for each section.
                </p>
                <Button onClick={() => generateOutline()} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate Outline
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : outline.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {totalMinutes} min total
              </Badge>
              <span className="text-sm text-muted-foreground">
                Target: {formData.durationMinutes} min
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => generateOutline()} disabled={generating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
                Regenerate All
              </Button>
              <Button variant="outline" onClick={() => addSection()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {outline.map((section) => (
              <Card
                key={section.id}
                className={`transition-all ${
                  expandedSections.has(section.id) ? "" : "bg-muted/50"
                }`}
              >
                <CardHeader
                  className="py-3 px-4 cursor-pointer"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Badge variant="outline" className={TYPE_COLORS[section.type]}>
                      {TYPE_ICONS[section.type]}
                      <span className="ml-1 capitalize">{section.type.replace("_", " ")}</span>
                    </Badge>
                    <span className="font-medium flex-1">{section.title}</span>
                    <span className="text-sm text-muted-foreground">
                      ~{section.estimatedMinutes} min
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSection(section.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>

                {expandedSections.has(section.id) && (
                  <CardContent className="pt-0 pb-4 px-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={section.title}
                          onChange={(e) =>
                            updateSection(section.id, { title: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={section.estimatedMinutes}
                          onChange={(e) =>
                            updateSection(section.id, {
                              estimatedMinutes: parseInt(e.target.value) || 1,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={section.content}
                        onChange={(e) =>
                          updateSection(section.id, { content: e.target.value })
                        }
                        rows={2}
                        className="mt-1"
                      />
                    </div>

                    {section.options && section.options.length > 0 && (
                      <div>
                        <Label className="text-xs mb-2 block">Options (select one)</Label>
                        <RadioGroup
                          value={section.selectedOption?.toString() || "0"}
                          onValueChange={(val) =>
                            updateSection(section.id, { selectedOption: parseInt(val) })
                          }
                        >
                          {section.options.map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted"
                            >
                              <RadioGroupItem
                                value={optIndex.toString()}
                                id={`${section.id}_opt_${optIndex}`}
                              />
                              <Label
                                htmlFor={`${section.id}_opt_${optIndex}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {option}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSection(section.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Below
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
