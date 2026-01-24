import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  RefreshCw,
  Check,
  Edit3,
  BookOpen,
  Quote,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StoryInsertDialog } from "../StoryInsertDialog";
import { QuoteInsertDialog } from "../QuoteInsertDialog";
import type { SpeechFormData } from "../SpeechWizard";
import type { OutlineSection } from "@/pages/Speeches";

interface SpeechScriptStepProps {
  formData: SpeechFormData;
  outline: OutlineSection[];
  fullScript: string;
  onScriptChange: (script: string) => void;
  onOutlineChange: (outline: OutlineSection[]) => void;
}

export function SpeechScriptStep({
  formData,
  outline,
  fullScript,
  onScriptChange,
  onOutlineChange,
}: SpeechScriptStepProps) {
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(outline.map((s) => s.id))
  );
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const { toast } = useToast();

  // Build full script from all sections
  useEffect(() => {
    const script = outline
      .map((section) => section.scriptContent || "")
      .filter(Boolean)
      .join("\n\n---\n\n");
    onScriptChange(script);
  }, [outline]);

  const generateSectionContent = async (sectionId: string) => {
    const section = outline.find((s) => s.id === sectionId);
    if (!section) return;

    setGeneratingSectionId(sectionId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-speech-content", {
        body: {
          action: "generate_section_content",
          section: {
            id: section.id,
            type: section.type,
            title: section.title,
            content: section.content,
            options: section.options,
            selectedOption: section.selectedOption,
            estimatedMinutes: section.estimatedMinutes,
          },
          context: {
            topic: formData.topic,
            targetAudience: formData.targetAudience,
            speechType: formData.speechType,
            keyMessage: formData.keyMessage,
          },
        },
      });

      if (error) throw error;

      if (data.content) {
        updateSectionScript(sectionId, data.content);
        toast({ title: "Content generated!" });
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast({
        title: "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setGeneratingSectionId(null);
    }
  };

  const regenerateSectionContent = async (sectionId: string) => {
    const section = outline.find((s) => s.id === sectionId);
    if (!section) return;

    setGeneratingSectionId(sectionId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-speech-content", {
        body: {
          action: "regenerate_section",
          section: {
            id: section.id,
            type: section.type,
            title: section.title,
            originalContent: section.scriptContent,
            estimatedMinutes: section.estimatedMinutes,
          },
          context: {
            topic: formData.topic,
            targetAudience: formData.targetAudience,
            keyMessage: formData.keyMessage,
          },
        },
      });

      if (error) throw error;

      if (data.content) {
        updateSectionScript(sectionId, data.content);
        toast({ title: "Content regenerated!" });
      }
    } catch (error) {
      console.error("Error regenerating content:", error);
      toast({
        title: "Failed to regenerate",
        variant: "destructive",
      });
    } finally {
      setGeneratingSectionId(null);
    }
  };

  const updateSectionScript = (sectionId: string, content: string) => {
    onOutlineChange(
      outline.map((section) =>
        section.id === sectionId ? { ...section, scriptContent: content } : section
      )
    );
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

  const getWordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
  const getMinutes = (words: number) => Math.round(words / 150);

  const handleInsertStory = (storyText: string) => {
    if (!activeSectionId) return;
    const section = outline.find((s) => s.id === activeSectionId);
    if (!section) return;

    const newContent = (section.scriptContent || "") + "\n\n" + storyText;
    updateSectionScript(activeSectionId, newContent);
    setStoryDialogOpen(false);
    toast({ title: "Story inserted!" });
  };

  const handleInsertQuote = (quoteText: string, attribution: string) => {
    if (!activeSectionId) return;
    const section = outline.find((s) => s.id === activeSectionId);
    if (!section) return;

    const formattedQuote = `"${quoteText}" — ${attribution}`;
    const newContent = (section.scriptContent || "") + "\n\n" + formattedQuote;
    updateSectionScript(activeSectionId, newContent);
    setQuoteDialogOpen(false);
    toast({ title: "Quote inserted!" });
  };

  const totalWords = outline.reduce(
    (sum, s) => sum + getWordCount(s.scriptContent || ""),
    0
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Write Your Script</h2>
          <p className="text-muted-foreground mt-1">
            Generate and edit content for each section
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {totalWords} words • ~{getMinutes(totalWords)} min
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {outline.map((section, index) => {
          const wordCount = getWordCount(section.scriptContent || "");
          const isGenerating = generatingSectionId === section.id;
          const isEditing = editingSection === section.id;
          const isExpanded = expandedSections.has(section.id);

          return (
            <Card key={section.id}>
              <CardHeader
                className="py-3 px-4 cursor-pointer"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {index + 1}.
                    </span>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {section.scriptContent && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {wordCount} words
                    </span>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {section.scriptContent ? (
                    <>
                      {isEditing ? (
                        <Textarea
                          value={section.scriptContent}
                          onChange={(e) =>
                            updateSectionScript(section.id, e.target.value)
                          }
                          rows={10}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="bg-muted/50 rounded-lg p-4 max-h-60 overflow-auto">
                          <pre className="text-sm whitespace-pre-wrap font-sans">
                            {section.scriptContent}
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveSectionId(section.id);
                              setStoryDialogOpen(true);
                            }}
                          >
                            <BookOpen className="h-4 w-4 mr-1" />
                            Insert Story
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveSectionId(section.id);
                              setQuoteDialogOpen(true);
                            }}
                          >
                            <Quote className="h-4 w-4 mr-1" />
                            Insert Quote
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Add interaction placeholder
                              const interaction =
                                "\n\n[INTERACTION: Ask the audience...]\n\n";
                              updateSectionScript(
                                section.id,
                                section.scriptContent + interaction
                              );
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Add Interaction
                          </Button>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingSection(isEditing ? null : section.id)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            {isEditing ? "Done" : "Edit"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateSectionContent(section.id)}
                            disabled={isGenerating}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-1 ${isGenerating ? "animate-spin" : ""}`}
                            />
                            Regenerate
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        {section.content}
                      </p>
                      <Button
                        onClick={() => generateSectionContent(section.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Content
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <StoryInsertDialog
        open={storyDialogOpen}
        onOpenChange={setStoryDialogOpen}
        onInsert={handleInsertStory}
        speechContext={{
          topic: formData.topic,
          keyMessage: formData.keyMessage,
        }}
      />

      <QuoteInsertDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onInsert={handleInsertQuote}
      />
    </div>
  );
}
