import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List, FileText, Mail, MessageSquare, Heart, MoreHorizontal, Star, Copy, Trash2, Share2 } from "lucide-react";
import { TemplateEditorDialog } from "@/components/templates/TemplateEditorDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSeedTemplates } from "@/hooks/useSeedTemplates";
import { AppLayout } from "@/components/AppLayout";

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

const categoryIcons: Record<string, React.ReactNode> = {
  pitch: <Mail className="h-4 w-4" />,
  follow_up: <MessageSquare className="h-4 w-4" />,
  thank_you: <Heart className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  pitch: "Pitch",
  follow_up: "Follow-up",
  thank_you: "Thank You",
  custom: "Custom",
};

export default function Templates() {
  const { seeded } = useSeedTemplates();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [bestTemplate, setBestTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (seeded) {
      loadTemplates();
    }
  }, [seeded]);

  const loadTemplates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('speaker_id', session.user.id)
        .order('times_used', { ascending: false });

      if (error) throw error;

      setTemplates(data || []);
      
      // Find best performing template
      const best = data?.find(t => t.times_used > 0);
      if (best) setBestTemplate(best);
    } catch (error) {
      console.error('Load templates error:', error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('email_templates')
        .insert({
          speaker_id: session.user.id,
          name: `${template.name} (Copy)`,
          category: template.category,
          subject_template: template.subject_template,
          body_template: template.body_template,
          variables: template.variables,
          is_default: false,
        });

      if (error) throw error;

      toast.success("Template duplicated!");
      loadTemplates();
    } catch (error) {
      console.error('Duplicate error:', error);
      toast.error("Failed to duplicate template");
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success("Template deleted");
      loadTemplates();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete template");
    }
  };

  const handleShare = async (template: EmailTemplate) => {
    const shareData = {
      name: template.name,
      category: template.category,
      subject_template: template.subject_template,
      body_template: template.body_template,
      variables: template.variables,
    };
    const shareString = btoa(JSON.stringify(shareData));
    const shareUrl = `${window.location.origin}/templates?import=${shareString}`;
    
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = searchQuery === "" || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body_template.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Manage and customize your email templates for pitches, follow-ups, and more
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Best Performing Template */}
      {bestTemplate && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-primary fill-primary" />
              <div>
                <p className="text-sm font-medium">Your Best Performing Template</p>
                <p className="text-lg font-semibold">{bestTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  Used {bestTemplate.times_used} times
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="pitch">Pitch</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="thank_you">Thank You</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Templates Grid/List */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {templates.length === 0 
                ? "Get started by creating your first template"
                : "Try adjusting your search or filter"
              }
            </p>
            {templates.length === 0 && (
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleEdit(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {categoryIcons[template.category]}
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[template.category]}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShare(template); }}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {template.subject_template}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body_template}
                </p>
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>Used {template.times_used} times</span>
                  {template.is_default && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleEdit(template)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                      {categoryIcons[template.category]}
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[template.category]}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">{template.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {template.subject_template}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm text-muted-foreground">
                      Used {template.times_used}x
                    </span>
                    {template.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShare(template); }}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={selectedTemplate}
        onSave={loadTemplates}
      />
    </div>
    </AppLayout>
  );
}
