import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { SpeechParametersStep } from "./steps/SpeechParametersStep";
import { SpeechOutlineStep } from "./steps/SpeechOutlineStep";
import { SpeechScriptStep } from "./steps/SpeechScriptStep";
import { SpeechReviewStep } from "./steps/SpeechReviewStep";
import type { Speech, OutlineSection } from "@/pages/Speeches";

interface SpeechWizardProps {
  speech: Speech | null;
  onSave: (speech: Partial<Speech>) => Promise<void>;
  onCancel: () => void;
}

export interface SpeechFormData {
  title: string;
  autoGenerateTitle: boolean;
  topic: string;
  targetAudience: string;
  durationMinutes: number;
  speechType: string;
  industryContext: string;
  keyMessage: string;
  desiredOutcome: string;
  selectedTemplate: string | null;
}

const STEPS = [
  { id: 1, name: "Parameters", description: "Define your speech" },
  { id: 2, name: "Outline", description: "Structure your content" },
  { id: 3, name: "Script", description: "Write your speech" },
  { id: 4, name: "Review", description: "Final polish" },
];

export function SpeechWizard({ speech, onSave, onCancel }: SpeechWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<SpeechFormData>({
    title: speech?.title || "",
    autoGenerateTitle: !speech?.title,
    topic: speech?.topic || "",
    targetAudience: speech?.target_audience || "",
    durationMinutes: speech?.duration_minutes || 30,
    speechType: speech?.speech_type || "keynote",
    industryContext: speech?.industry_context || "",
    keyMessage: speech?.key_message || "",
    desiredOutcome: speech?.desired_outcome || "",
    selectedTemplate: speech?.selected_template || null,
  });

  const [outline, setOutline] = useState<OutlineSection[]>(speech?.outline || []);
  const [fullScript, setFullScript] = useState(speech?.full_script || "");

  // Calculate word count and duration
  const wordCount = fullScript.split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.round(wordCount / 150); // ~150 words per minute

  const handleSave = async (status: "draft" | "in_progress" | "complete" = "in_progress") => {
    setSaving(true);
    try {
      await onSave({
        title: formData.autoGenerateTitle && outline.length > 0 
          ? formData.title || "Untitled Speech"
          : formData.title,
        topic: formData.topic,
        target_audience: formData.targetAudience,
        duration_minutes: formData.durationMinutes,
        speech_type: formData.speechType,
        industry_context: formData.industryContext,
        key_message: formData.keyMessage,
        desired_outcome: formData.desiredOutcome,
        selected_template: formData.selectedTemplate,
        outline: outline as unknown as Speech["outline"],
        full_script: fullScript,
        word_count: wordCount,
        estimated_duration: estimatedDuration,
        status,
      });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.topic && formData.targetAudience && formData.keyMessage;
      case 2:
        return outline.length > 0;
      case 3:
        return fullScript.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      // Auto-save on step change
      handleSave(currentStep >= 3 ? "in_progress" : "draft");
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Progress Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id === currentStep
                    ? "text-primary"
                    : step.id < currentStep
                    ? "text-primary/70"
                    : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.id === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.id < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted"
                  }`}
                >
                  {step.id}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{step.name}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="w-12 h-px bg-border mx-2 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <Progress value={(currentStep / 4) * 100} className="h-1" />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto p-6">
        {currentStep === 1 && (
          <SpeechParametersStep
            formData={formData}
            onChange={setFormData}
          />
        )}
        {currentStep === 2 && (
          <SpeechOutlineStep
            formData={formData}
            outline={outline}
            onOutlineChange={setOutline}
            onTitleGenerated={(title) => setFormData({ ...formData, title })}
          />
        )}
        {currentStep === 3 && (
          <SpeechScriptStep
            formData={formData}
            outline={outline}
            fullScript={fullScript}
            onScriptChange={setFullScript}
            onOutlineChange={setOutline}
          />
        )}
        {currentStep === 4 && (
          <SpeechReviewStep
            formData={formData}
            outline={outline}
            fullScript={fullScript}
            wordCount={wordCount}
            estimatedDuration={estimatedDuration}
          />
        )}
      </div>

      {/* Navigation Footer */}
      <div className="border-t bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {wordCount} words • ~{estimatedDuration} min
          </span>
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => handleSave("complete")} disabled={saving}>
              Complete Speech
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
