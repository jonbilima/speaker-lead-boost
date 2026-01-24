import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpeechFormData } from "../SpeechWizard";

interface SpeechParametersStepProps {
  formData: SpeechFormData;
  onChange: (data: SpeechFormData) => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 minutes (Lightning Talk)" },
  { value: 30, label: "30 minutes (Standard)" },
  { value: 45, label: "45 minutes (Extended)" },
  { value: 60, label: "60 minutes (Full Keynote)" },
  { value: 90, label: "90 minutes (Workshop)" },
];

const SPEECH_TYPES = [
  { value: "keynote", label: "🎤 Keynote", description: "Inspiring, high-level message" },
  { value: "workshop", label: "🛠️ Workshop", description: "Interactive, hands-on learning" },
  { value: "sermon", label: "✝️ Sermon", description: "Faith-based message" },
  { value: "ted_style", label: "💡 TED-style", description: "Idea worth spreading" },
  { value: "training", label: "📚 Training", description: "Educational, skill-building" },
  { value: "panel", label: "🗣️ Panel Remarks", description: "Discussion points" },
];

const INDUSTRIES = [
  "Corporate / Business",
  "Technology",
  "Healthcare",
  "Education",
  "Faith-based",
  "Non-profit",
  "Government",
  "Finance",
  "Marketing / Sales",
  "Personal Development",
  "Other",
];

export function SpeechParametersStep({ formData, onChange }: SpeechParametersStepProps) {
  const updateField = <K extends keyof SpeechFormData>(
    field: K,
    value: SpeechFormData[K]
  ) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Define Your Speech</h2>
        <p className="text-muted-foreground mt-2">
          Tell us about your speech so we can help you create the perfect structure
        </p>
      </div>

      {/* Title */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="title">Speech Title</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="autoTitle"
              checked={formData.autoGenerateTitle}
              onCheckedChange={(checked) =>
                updateField("autoGenerateTitle", checked as boolean)
              }
            />
            <Label htmlFor="autoTitle" className="text-sm text-muted-foreground cursor-pointer">
              Help me create a title
            </Label>
          </div>
        </div>
        <Input
          id="title"
          placeholder={formData.autoGenerateTitle ? "We'll suggest a title based on your content" : "Enter your speech title"}
          value={formData.title}
          onChange={(e) => updateField("title", e.target.value)}
          disabled={formData.autoGenerateTitle}
          className={formData.autoGenerateTitle ? "bg-muted" : ""}
        />
      </div>

      {/* Topic */}
      <div className="space-y-3">
        <Label htmlFor="topic">Topic / Theme *</Label>
        <Input
          id="topic"
          placeholder="e.g., Leadership in uncertain times, Digital transformation, Building resilience"
          value={formData.topic}
          onChange={(e) => updateField("topic", e.target.value)}
        />
      </div>

      {/* Target Audience */}
      <div className="space-y-3">
        <Label htmlFor="audience">Target Audience *</Label>
        <Textarea
          id="audience"
          placeholder="Describe who will be listening. What are their roles, challenges, and what do they need to hear?"
          value={formData.targetAudience}
          onChange={(e) => updateField("targetAudience", e.target.value)}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Example: "Mid-level managers at a tech company struggling with remote team engagement"
        </p>
      </div>

      {/* Duration and Speech Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label>Duration</Label>
          <Select
            value={formData.durationMinutes.toString()}
            onValueChange={(val) => updateField("durationMinutes", parseInt(val))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Speech Type</Label>
          <Select
            value={formData.speechType}
            onValueChange={(val) => updateField("speechType", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEECH_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div>
                    <span>{type.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      - {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Industry Context */}
      <div className="space-y-3">
        <Label>Industry Context</Label>
        <Select
          value={formData.industryContext}
          onValueChange={(val) => updateField("industryContext", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select industry context" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Key Message */}
      <div className="space-y-3">
        <Label htmlFor="keyMessage">Key Message *</Label>
        <Input
          id="keyMessage"
          placeholder="The ONE thing your audience should remember"
          value={formData.keyMessage}
          onChange={(e) => updateField("keyMessage", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Keep it to one sentence. This will anchor your entire speech.
        </p>
      </div>

      {/* Desired Outcome */}
      <div className="space-y-3">
        <Label htmlFor="outcome">Desired Outcome</Label>
        <Textarea
          id="outcome"
          placeholder="What should your audience think, feel, or do after your speech?"
          value={formData.desiredOutcome}
          onChange={(e) => updateField("desiredOutcome", e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
