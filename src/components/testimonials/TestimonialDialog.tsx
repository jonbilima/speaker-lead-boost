import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Save, Upload } from "lucide-react";
import { Testimonial } from "./TestimonialTypes";

interface TestimonialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial: Testimonial | null;
  onSave: () => void;
  featuredCount: number;
}

export function TestimonialDialog({ open, onOpenChange, testimonial, onSave, featuredCount }: TestimonialDialogProps) {
  const [quote, setQuote] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorTitle, setAuthorTitle] = useState("");
  const [authorCompany, setAuthorCompany] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [isFeatured, setIsFeatured] = useState(false);
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (testimonial) {
      setQuote(testimonial.quote || "");
      setAuthorName(testimonial.author_name || "");
      setAuthorTitle(testimonial.author_title || "");
      setAuthorCompany(testimonial.author_company || "");
      setAuthorEmail(testimonial.author_email || "");
      setEventName(testimonial.event_name || "");
      setEventDate(testimonial.event_date || "");
      setRating(testimonial.rating || 5);
      setIsFeatured(testimonial.is_featured || false);
      setAuthorPhotoUrl(testimonial.author_photo_url || "");
    } else {
      setQuote("");
      setAuthorName("");
      setAuthorTitle("");
      setAuthorCompany("");
      setAuthorEmail("");
      setEventName("");
      setEventDate("");
      setRating(5);
      setIsFeatured(false);
      setAuthorPhotoUrl("");
    }
  }, [testimonial, open]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/testimonials/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('speaker-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('speaker-assets')
        .getPublicUrl(fileName);

      setAuthorPhotoUrl(publicUrl);
      toast.success("Photo uploaded!");
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!quote.trim()) {
      toast.error("Please enter the testimonial quote");
      return;
    }
    if (!authorName.trim()) {
      toast.error("Please enter the author's name");
      return;
    }

    // Check featured limit
    if (isFeatured && !testimonial?.is_featured && featuredCount >= 3) {
      toast.error("Maximum 3 featured testimonials allowed");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const testimonialData = {
        quote,
        author_name: authorName,
        author_title: authorTitle || null,
        author_company: authorCompany || null,
        author_email: authorEmail || null,
        author_photo_url: authorPhotoUrl || null,
        event_name: eventName || null,
        event_date: eventDate || null,
        rating,
        is_featured: isFeatured,
      };

      if (testimonial) {
        const { error } = await supabase
          .from('testimonials')
          .update(testimonialData)
          .eq('id', testimonial.id);

        if (error) throw error;
        toast.success("Testimonial updated!");
      } else {
        const { error } = await supabase
          .from('testimonials')
          .insert({
            ...testimonialData,
            speaker_id: session.user.id,
            source: 'manual',
          });

        if (error) throw error;
        toast.success("Testimonial added!");
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save testimonial";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{testimonial ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          <DialogDescription>
            {testimonial 
              ? "Update the testimonial details"
              : "Add a new testimonial from a client or attendee"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Quote */}
          <div className="space-y-2">
            <Label htmlFor="quote">Testimonial Quote *</Label>
            <Textarea
              id="quote"
              placeholder="What did they say about you?"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={4}
            />
          </div>

          {/* Author Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authorName">Author Name *</Label>
              <Input
                id="authorName"
                placeholder="John Smith"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authorEmail">Author Email</Label>
              <Input
                id="authorEmail"
                type="email"
                placeholder="john@company.com"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authorTitle">Title/Role</Label>
              <Input
                id="authorTitle"
                placeholder="CEO"
                value={authorTitle}
                onChange={(e) => setAuthorTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authorCompany">Company</Label>
              <Input
                id="authorCompany"
                placeholder="Acme Inc."
                value={authorCompany}
                onChange={(e) => setAuthorCompany(e.target.value)}
              />
            </div>
          </div>

          {/* Author Photo */}
          <div className="space-y-2">
            <Label>Author Photo</Label>
            <div className="flex items-center gap-4">
              {authorPhotoUrl ? (
                <img
                  src={authorPhotoUrl}
                  alt="Author"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-lg font-medium text-muted-foreground">
                    {authorName.charAt(0) || "?"}
                  </span>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
              </div>
            </div>
          </div>

          {/* Event Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                placeholder="TechConnect Summit 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Featured */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="featured"
              checked={isFeatured}
              onCheckedChange={(checked) => setIsFeatured(checked === true)}
              disabled={!testimonial?.is_featured && featuredCount >= 3}
            />
            <Label htmlFor="featured" className="text-sm">
              Mark as Featured {featuredCount >= 3 && !testimonial?.is_featured && "(limit reached)"}
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : testimonial ? "Update" : "Add Testimonial"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
