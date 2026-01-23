import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Copy, Eye, Wand2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_template: string;
  variables: string[];
  is_default: boolean;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  onSave: () => void;
}

const availableVariables = [
  { key: "event_name", label: "Event Name", sample: "TechConnect Summit 2026" },
  { key: "organizer_name", label: "Organizer Name", sample: "Sarah Chen" },
  { key: "organization", label: "Organization", sample: "TechConnect Inc." },
  { key: "event_date", label: "Event Date", sample: "March 15, 2026" },
  { key: "speaker_name", label: "Speaker Name", sample: "John Smith" },
  { key: "speaker_topic", label: "Speaker Topic", sample: "AI and Machine Learning" },
  { key: "fee_range", label: "Fee Range", sample: "$5,000 - $10,000" },
];

const categoryLabels: Record<string, string> = {
  pitch: "Pitch",
  follow_up: "Follow-up",
  thank_you: "Thank You",
  custom: "Custom",
};

export function TemplateEditorDialog({ open, onOpenChange, template, onSave }: TemplateEditorDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [usedVariables, setUsedVariables] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory(template.category);
      setSubjectTemplate(template.subject_template);
      setBodyTemplate(template.body_template);
      setUsedVariables(template.variables || []);
    } else {
      setName("");
      setCategory("custom");
      setSubjectTemplate("");
      setBodyTemplate("");
      setUsedVariables([]);
    }
    setActiveTab("edit");
  }, [template, open]);

  // Extract variables from content
  useEffect(() => {
    const content = `${subjectTemplate} ${bodyTemplate}`;
    const foundVariables = availableVariables
      .filter(v => content.includes(`{${v.key}}`))
      .map(v => v.key);
    setUsedVariables(foundVariables);
  }, [subjectTemplate, bodyTemplate]);

  const insertVariable = (variable: string, field: "subject" | "body") => {
    const insertText = `{${variable}}`;
    if (field === "subject") {
      setSubjectTemplate(prev => prev + insertText);
    } else {
      setBodyTemplate(prev => prev + insertText);
    }
  };

  const getPreviewContent = (content: string) => {
    let result = content;
    availableVariables.forEach(v => {
      result = result.replace(new RegExp(`\\{${v.key}\\}`, 'g'), v.sample);
    });
    return result;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!subjectTemplate.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!bodyTemplate.trim()) {
      toast.error("Please enter a body template");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      if (template) {
        // Update existing
        const { error } = await supabase
          .from('email_templates')
          .update({
            name,
            category,
            subject_template: subjectTemplate,
            body_template: bodyTemplate,
            variables: usedVariables,
          })
          .eq('id', template.id);

        if (error) throw error;
        toast.success("Template updated!");
      } else {
        // Create new
        const { error } = await supabase
          .from('email_templates')
          .insert({
            speaker_id: session.user.id,
            name,
            category,
            subject_template: subjectTemplate,
            body_template: bodyTemplate,
            variables: usedVariables,
          });

        if (error) throw error;
        toast.success("Template created!");
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsCopy = async () => {
    if (!name.trim() || !subjectTemplate.trim() || !bodyTemplate.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('email_templates')
        .insert({
          speaker_id: session.user.id,
          name: `${name} (Copy)`,
          category,
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
          variables: usedVariables,
        });

      if (error) throw error;

      toast.success("Template saved as copy!");
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Save as copy error:', error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {template 
              ? "Update your email template with variables for personalization"
              : "Create a reusable email template with personalization variables"
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">
              <Wand2 className="h-4 w-4 mr-2" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Conference Cold Pitch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitch">Pitch</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="thank_you">Thank You</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject">Subject Line</Label>
                <div className="flex flex-wrap gap-1">
                  {availableVariables.slice(0, 4).map((v) => (
                    <Button
                      key={v.key}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(v.key, "subject")}
                    >
                      {`{${v.key}}`}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                id="subject"
                placeholder="e.g., Speaking Opportunity for {event_name}"
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body</Label>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {availableVariables.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => insertVariable(v.key, "body")}
                  >
                    {`{${v.key}}`}
                  </Button>
                ))}
              </div>
              <Textarea
                id="body"
                placeholder="Dear {organizer_name},

I came across {event_name} and..."
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={14}
              />
            </div>

            {usedVariables.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Variables used:</span>
                {usedVariables.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="bg-muted/50 p-6 rounded-lg space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                <p className="font-semibold">{getPreviewContent(subjectTemplate) || "No subject line"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Body:</p>
                <div className="whitespace-pre-wrap bg-background p-4 rounded border">
                  {getPreviewContent(bodyTemplate) || "No body content"}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              * Preview shows sample data. Actual values will be filled in when using the template.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {template && (
              <Button variant="outline" onClick={handleSaveAsCopy} disabled={saving}>
                <Copy className="h-4 w-4 mr-2" />
                Save as Copy
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : template ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
