import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, Quote, Mail, MoreHorizontal, Trash2, Edit, Image, Linkedin } from "lucide-react";
import { Testimonial } from "./TestimonialTypes";
import { TestimonialDialog } from "./TestimonialDialog";
import { RequestTestimonialDialog } from "./RequestTestimonialDialog";
import { SocialGraphicDialog } from "./SocialGraphicDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function TestimonialsTab() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [graphicDialogOpen, setGraphicDialogOpen] = useState(false);
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);

  useEffect(() => {
    loadTestimonials();
  }, []);

  const loadTestimonials = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .eq('speaker_id', session.user.id)
        .not('quote', 'is', null)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTestimonials((data as Testimonial[]) || []);
    } catch (error) {
      console.error('Load testimonials error:', error);
      toast.error("Failed to load testimonials");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    setSelectedTestimonial(testimonial);
    setDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedTestimonial(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Testimonial deleted");
      loadTestimonials();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete testimonial");
    }
  };

  const handleGenerateGraphic = (testimonial: Testimonial) => {
    setSelectedTestimonial(testimonial);
    setGraphicDialogOpen(true);
  };

  const featuredCount = testimonials.filter(t => t.is_featured).length;

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Testimonials</h2>
          <p className="text-sm text-muted-foreground">
            {testimonials.length} testimonial{testimonials.length !== 1 ? 's' : ''} • {featuredCount}/3 featured
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRequestDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Request
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Testimonial
          </Button>
        </div>
      </div>

      {/* LinkedIn Import Placeholder */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Linkedin className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">Import from LinkedIn</p>
              <p className="text-sm text-muted-foreground">Automatically import recommendations from your profile</p>
            </div>
          </div>
          <Badge variant="secondary">Coming Soon</Badge>
        </CardContent>
      </Card>

      {/* Testimonials Grid */}
      {testimonials.length === 0 ? (
        <Card className="p-12 text-center">
          <Quote className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-medium mb-2">No testimonials yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add testimonials from clients and attendees to build social proof
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setRequestDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Request Testimonial
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="hover:shadow-md transition-shadow cursor-pointer relative"
              onClick={() => handleEdit(testimonial)}
            >
              {testimonial.is_featured && (
                <Badge className="absolute top-3 right-3 bg-yellow-500">Featured</Badge>
              )}
              <CardContent className="pt-6 pb-4">
                <div className="space-y-3">
                  {/* Quote */}
                  <div className="relative">
                    <Quote className="h-6 w-6 text-primary/20 absolute -top-1 -left-1" />
                    <p className="text-sm line-clamp-4 pl-4">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Rating */}
                  {renderStars(testimonial.rating)}

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    {testimonial.author_photo_url ? (
                      <img
                        src={testimonial.author_photo_url}
                        alt={testimonial.author_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {testimonial.author_name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{testimonial.author_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[testimonial.author_title, testimonial.author_company]
                          .filter(Boolean)
                          .join(' at ')}
                      </p>
                    </div>
                  </div>

                  {/* Event */}
                  {testimonial.event_name && (
                    <p className="text-xs text-muted-foreground">
                      {testimonial.event_name}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end pt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(testimonial); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleGenerateGraphic(testimonial); }}>
                          <Image className="h-4 w-4 mr-2" />
                          Generate Graphic
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDelete(testimonial.id); }}
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

      <TestimonialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testimonial={selectedTestimonial}
        onSave={loadTestimonials}
        featuredCount={featuredCount}
      />

      <RequestTestimonialDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onRequestSent={loadTestimonials}
      />

      <SocialGraphicDialog
        open={graphicDialogOpen}
        onOpenChange={setGraphicDialogOpen}
        testimonial={selectedTestimonial}
      />
    </div>
  );
}
