import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  FileText,
  Monitor,
  Clock,
  BookOpen,
  Quote,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PracticeModeDialog } from "../PracticeModeDialog";
import type { SpeechFormData } from "../SpeechWizard";
import type { OutlineSection } from "@/pages/Speeches";

interface SpeechReviewStepProps {
  formData: SpeechFormData;
  outline: OutlineSection[];
  fullScript: string;
  wordCount: number;
  estimatedDuration: number;
}

export function SpeechReviewStep({
  formData,
  outline,
  fullScript,
  wordCount,
  estimatedDuration,
}: SpeechReviewStepProps) {
  const [practiceModeOpen, setPracticeModeOpen] = useState(false);

  // Calculate readability (simplified Flesch-Kincaid)
  const sentences = fullScript.split(/[.!?]+/).filter(Boolean).length;
  const words = wordCount;
  const avgWordsPerSentence = words / (sentences || 1);
  const readabilityScore = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWordsPerSentence));
  
  const getReadabilityLabel = (score: number) => {
    if (score >= 80) return { label: "Very Easy", color: "text-green-600" };
    if (score >= 60) return { label: "Easy", color: "text-green-500" };
    if (score >= 40) return { label: "Standard", color: "text-yellow-600" };
    if (score >= 20) return { label: "Difficult", color: "text-orange-500" };
    return { label: "Very Difficult", color: "text-red-500" };
  };

  const readability = getReadabilityLabel(readabilityScore);

  // Count elements
  const storyCount = (fullScript.match(/\[STORY\]|\[Story\]|Once upon|I remember/gi) || []).length;
  const quoteCount = (fullScript.match(/"[^"]+"\s*—/g) || []).length;
  const interactionCount = (fullScript.match(/\[INTERACTION\]|\[PAUSE\]|Ask the audience/gi) || []).length;

  const exportAsPDF = () => {
    // Create print-friendly version
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${formData.title || "Speech"}</title>
          <style>
            body {
              font-family: Georgia, serif;
              line-height: 1.8;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
            }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .meta { color: #666; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .section-title { font-weight: bold; margin-bottom: 10px; }
            .content { white-space: pre-wrap; }
            @media print {
              body { margin: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>${formData.title || "Untitled Speech"}</h1>
          <div class="meta">
            ${formData.speechType} • ${estimatedDuration} minutes • ${wordCount} words
          </div>
          ${outline
            .map(
              (section) => `
            <div class="section">
              <div class="section-title">${section.title}</div>
              <div class="content">${section.scriptContent || ""}</div>
            </div>
          `
            )
            .join("")}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const exportAsTeleprompter = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const cleanScript = fullScript
      .replace(/\[PAUSE\]/gi, "▪️ PAUSE ▪️")
      .replace(/\[INTERACTION[^\]]*\]/gi, "🎤 INTERACT 🎤");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Teleprompter - ${formData.title || "Speech"}</title>
          <style>
            body {
              background: #000;
              color: #fff;
              font-family: Arial, sans-serif;
              font-size: 32px;
              line-height: 1.6;
              padding: 40px 80px;
              max-width: 100%;
            }
            p { margin-bottom: 40px; }
            .pause { color: #fbbf24; font-weight: bold; }
            .interact { color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          ${cleanScript
            .split("\n\n")
            .map((p) => `<p>${p}</p>`)
            .join("")}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const durationDiff = estimatedDuration - formData.durationMinutes;
  const onTrack = Math.abs(durationDiff) <= 5;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">{formData.title || "Your Speech"}</h2>
        <p className="text-muted-foreground mt-2">
          Review your complete speech and export when ready
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <p className="text-2xl font-bold mt-1">~{estimatedDuration} min</p>
            <p className={`text-xs ${onTrack ? "text-green-600" : "text-yellow-600"}`}>
              {onTrack ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> On target
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {durationDiff > 0 ? `+${durationDiff}` : durationDiff} min from target
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Word Count</span>
            </div>
            <p className="text-2xl font-bold mt-1">{wordCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">~150 words/min</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Readability</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${readability.color}`}>
              {readability.label}
            </p>
            <p className="text-xs text-muted-foreground">Score: {Math.round(readabilityScore)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Elements</span>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                {storyCount} stories
              </Badge>
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {quoteCount} quotes
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {interactionCount} interaction points
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Full Script Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Complete Script</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPracticeModeOpen(true)}>
              <Monitor className="h-4 w-4 mr-2" />
              Practice Mode
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-lg border p-4">
            {outline.map((section, index) => (
              <div key={section.id} className="mb-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  {section.title}
                </h3>
                <div className="prose prose-sm max-w-none">
                  {section.scriptContent ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {section.scriptContent
                        .replace(/\[PAUSE\]/gi, "⏸️")
                        .replace(/\[INTERACTION[^\]]*\]/gi, "🎤")}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No content generated for this section
                    </p>
                  )}
                </div>
                {index < outline.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={exportAsPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Export as PDF
            </Button>
            <Button variant="outline" onClick={exportAsTeleprompter} className="gap-2">
              <Monitor className="h-4 w-4" />
              Teleprompter Format
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(fullScript);
              }}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Copy to Clipboard
            </Button>
          </div>
        </CardContent>
      </Card>

      <PracticeModeDialog
        open={practiceModeOpen}
        onOpenChange={setPracticeModeOpen}
        script={fullScript}
        targetDuration={formData.durationMinutes}
      />
    </div>
  );
}
