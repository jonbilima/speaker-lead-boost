import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function SpeechOutlineStep({
  formData,
  outline,
  onOutlineChange,
  onTitleGenerated,
}: SpeechOutlineStepProps) {
  const [generating, setGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const { toast } = useToast();

  const generateOutline = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-speech-content", {
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

      if (error) throw error;

      if (data.sections) {
        onOutlineChange(data.sections);
        // Expand all sections by default
        setExpandedSections(new Set(data.sections.map((s: OutlineSection) => s.id)));
      }

      if (data.suggestedTitle && formData.autoGenerateTitle) {
        onTitleGenerated(data.suggestedTitle);
      }

      toast({ title: "Outline generated!" });
    } catch (error) {
      console.error("Error generating outline:", error);
      toast({
        title: "Failed to generate outline",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
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

  const moveSection = (id: string, direction: "up" | "down") => {
    const index = outline.findIndex((s) => s.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === outline.length - 1)
    ) {
      return;
    }

    const newOutline = [...outline];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newOutline[index], newOutline[targetIndex]] = [
      newOutline[targetIndex],
      newOutline[index],
    ];
    onOutlineChange(newOutline);
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

      {outline.length === 0 ? (
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
                <Button onClick={generateOutline} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate Outline
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
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
              <Button variant="outline" onClick={generateOutline} disabled={generating}>
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
            {outline.map((section, index) => (
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
