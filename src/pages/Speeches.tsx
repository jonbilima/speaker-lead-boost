import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SpeechSidebar } from "@/components/speeches/SpeechSidebar";
import { SpeechWizard } from "@/components/speeches/SpeechWizard";
import { StoryBankTab } from "@/components/speeches/StoryBankTab";
import { QuoteLibraryTab } from "@/components/speeches/QuoteLibraryTab";
import { SpeechTemplates } from "@/components/speeches/SpeechTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, BookOpen, Quote, Layout } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

export interface Speech {
  id: string;
  speaker_id: string;
  title: string | null;
  topic: string | null;
  target_audience: string | null;
  duration_minutes: number;
  speech_type: string;
  industry_context: string | null;
  key_message: string | null;
  desired_outcome: string | null;
  outline: OutlineSection[];
  full_script: string | null;
  talking_points: TalkingPoint[];
  status: "draft" | "in_progress" | "complete";
  word_count: number;
  estimated_duration: number;
  selected_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutlineSection {
  id: string;
  type: "opening" | "main_point" | "story" | "interaction" | "closing";
  title: string;
  content: string;
  options?: string[];
  selectedOption?: number;
  estimatedMinutes: number;
  scriptContent?: string;
  [key: string]: unknown; // Allow Json compatibility
}

export interface TalkingPoint {
  id: string;
  text: string;
  sectionId: string;
  [key: string]: unknown;
}

export default function Speeches() {
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [selectedSpeech, setSelectedSpeech] = useState<Speech | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("speeches");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSpeeches();
  }, []);

  const fetchSpeeches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("speaker_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      // Parse JSONB fields
      const parsedSpeeches = (data || []).map(s => ({
        ...s,
        outline: (Array.isArray(s.outline) ? s.outline : []) as OutlineSection[],
        talking_points: (Array.isArray(s.talking_points) ? s.talking_points : []) as TalkingPoint[],
        status: s.status as "draft" | "in_progress" | "complete",
      })) as Speech[];
      
      setSpeeches(parsedSpeeches);
    } catch (error) {
      console.error("Error fetching speeches:", error);
      toast({
        title: "Error loading speeches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewSpeech = () => {
    setSelectedSpeech(null);
    setIsCreating(true);
    setActiveTab("speeches");
  };

  const handleSelectSpeech = (speech: Speech) => {
    setSelectedSpeech(speech);
    setIsCreating(true);
    setActiveTab("speeches");
  };

  const handleSaveSpeech = async (speech: Partial<Speech>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (selectedSpeech?.id) {
        // Update existing
        const { error } = await supabase
          .from("speeches")
          .update({
            ...speech,
            outline: speech.outline as unknown as Json,
            talking_points: speech.talking_points as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedSpeech.id);

        if (error) throw error;
        toast({ title: "Speech saved" });
      } else {
        // Create new
        const { data, error } = await supabase
          .from("speeches")
          .insert([{
            ...speech,
            outline: speech.outline as unknown as Json,
            talking_points: speech.talking_points as unknown as Json,
            speaker_id: user.id,
          }])
          .select()
          .single();

        if (error) throw error;
        
        const newSpeech = {
          ...data,
          outline: (Array.isArray(data.outline) ? data.outline : []) as OutlineSection[],
          talking_points: (Array.isArray(data.talking_points) ? data.talking_points : []) as TalkingPoint[],
          status: data.status as "draft" | "in_progress" | "complete",
        } as Speech;
        
        setSelectedSpeech(newSpeech);
        toast({ title: "Speech created" });
      }

      fetchSpeeches();
    } catch (error) {
      console.error("Error saving speech:", error);
      toast({
        title: "Error saving speech",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSpeech = async (id: string) => {
    try {
      const { error } = await supabase
        .from("speeches")
        .delete()
        .eq("id", id);

      if (error) throw error;

      if (selectedSpeech?.id === id) {
        setSelectedSpeech(null);
        setIsCreating(false);
      }

      fetchSpeeches();
      toast({ title: "Speech deleted" });
    } catch (error) {
      console.error("Error deleting speech:", error);
      toast({
        title: "Error deleting speech",
        variant: "destructive",
      });
    }
  };

  const handleSelectTemplate = (_templateId: string) => {
    setSelectedSpeech(null);
    setIsCreating(true);
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar */}
        <SpeechSidebar
          speeches={speeches}
          selectedSpeech={selectedSpeech}
          onSelectSpeech={handleSelectSpeech}
          onNewSpeech={handleNewSpeech}
          onDeleteSpeech={handleDeleteSpeech}
          loading={loading}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b px-6 pt-4">
              <TabsList>
                <TabsTrigger value="speeches" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Speech Builder
                </TabsTrigger>
                <TabsTrigger value="stories" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Story Bank
                </TabsTrigger>
                <TabsTrigger value="quotes" className="gap-2">
                  <Quote className="h-4 w-4" />
                  Quote Library
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-2">
                  <Layout className="h-4 w-4" />
                  Templates
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="speeches" className="flex-1 overflow-auto m-0">
              {isCreating ? (
                <SpeechWizard
                  speech={selectedSpeech}
                  onSave={handleSaveSpeech}
                  onCancel={() => {
                    setIsCreating(false);
                    setSelectedSpeech(null);
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Select a speech or create a new one</p>
                    <p className="text-sm mt-2">Use the sidebar to get started</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stories" className="flex-1 overflow-auto m-0 p-6">
              <StoryBankTab />
            </TabsContent>

            <TabsContent value="quotes" className="flex-1 overflow-auto m-0 p-6">
              <QuoteLibraryTab />
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-auto m-0 p-6">
              <SpeechTemplates onSelectTemplate={handleSelectTemplate} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
