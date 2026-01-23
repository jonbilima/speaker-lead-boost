import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Heart, FileText } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_template: string;
  variables: string[];
}

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate | null, filledSubject: string, filledBody: string) => void;
  eventData?: {
    event_name?: string;
    organizer_name?: string;
    organization?: string;
    event_date?: string;
    location?: string;
  };
  speakerData?: {
    name?: string;
    topics?: string[];
    fee_min?: number;
    fee_max?: number;
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  pitch: <Mail className="h-4 w-4" />,
  follow_up: <MessageSquare className="h-4 w-4" />,
  thank_you: <Heart className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

export function TemplateSelector({ onSelect, eventData, speakerData }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, category, subject_template, body_template, variables')
        .eq('speaker_id', session.user.id)
        .order('times_used', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Load templates error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fillTemplate = (content: string): string => {
    let result = content;
    
    // Event data
    if (eventData?.event_name) {
      result = result.replace(/{event_name}/g, eventData.event_name);
    }
    if (eventData?.organizer_name) {
      result = result.replace(/{organizer_name}/g, eventData.organizer_name);
    }
    if (eventData?.organization) {
      result = result.replace(/{organization}/g, eventData.organization);
    }
    if (eventData?.event_date) {
      const date = new Date(eventData.event_date);
      result = result.replace(/{event_date}/g, date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }));
    }
    
    // Speaker data
    if (speakerData?.name) {
      result = result.replace(/{speaker_name}/g, speakerData.name);
    }
    if (speakerData?.topics && speakerData.topics.length > 0) {
      result = result.replace(/{speaker_topic}/g, speakerData.topics[0]);
    }
    if (speakerData?.fee_min && speakerData?.fee_max) {
      result = result.replace(
        /{fee_range}/g, 
        `$${speakerData.fee_min.toLocaleString()} - $${speakerData.fee_max.toLocaleString()}`
      );
    }
    
    return result;
  };

  const handleSelect = (templateId: string) => {
    setSelectedId(templateId);
    
    if (templateId === "none") {
      onSelect(null, "", "");
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const filledSubject = fillTemplate(template.subject_template);
      const filledBody = fillTemplate(template.body_template);
      onSelect(template, filledSubject, filledBody);
      
      // Update times_used
      supabase
        .from('email_templates')
        .update({ 
          times_used: (templates.find(t => t.id === templateId) as any)?.times_used + 1 || 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .then(() => {});
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Start from template</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  return (
    <div className="space-y-2">
      <Label>Start from template</Label>
      <Select value={selectedId} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select a template..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">Write from scratch</span>
          </SelectItem>
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                {categoryIcons[category]}
                {category.replace('_', ' ')}
              </div>
              {categoryTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center gap-2">
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
