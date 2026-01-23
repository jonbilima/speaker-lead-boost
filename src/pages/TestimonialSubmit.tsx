import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Send, CheckCircle, AlertCircle, Upload } from "lucide-react";

interface TestimonialRequest {
  id: string;
  event_name: string | null;
  author_name: string;
  speaker_id: string;
  quote: string;
}

export default function TestimonialSubmit() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [request, setRequest] = useState<TestimonialRequest | null>(null);
  const [speakerName, setSpeakerName] = useState<string>("");
  
  const [quote, setQuote] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorTitle, setAuthorTitle] = useState("");
  const [authorCompany, setAuthorCompany] = useState("");
  const [rating, setRating] = useState<number>(5);
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      // Mark as opened
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, event_name, author_name, speaker_id, quote')
        .eq('request_token', token)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Check if already submitted
      if (data.quote && data.quote.trim() !== '') {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setRequest(data);
      setAuthorName(data.author_name !== 'Pending' ? data.author_name : '');

      // Update opened timestamp
      await supabase
        .from('testimonials')
        .update({ request_opened_at: new Date().toISOString() })
        .eq('id', data.id);

      // Get speaker name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.speaker_id)
        .single();

      if (profile?.name) {
        setSpeakerName(profile.name);
      }
    } catch (error) {
      console.error('Load request error:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Client-side validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image");
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      // Use secure edge function for upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);

      const { data, error } = await supabase.functions.invoke("upload-testimonial-photo", {
        body: formData,
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No URL returned");

      setAuthorPhotoUrl(data.url);
      toast.success("Photo uploaded!");
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!quote.trim()) {
      toast.error("Please enter your testimonial");
      return;
    }
    if (!authorName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!request) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({
          quote,
          author_name: authorName,
          author_title: authorTitle || null,
          author_company: authorCompany || null,
          author_photo_url: authorPhotoUrl || null,
          rating,
          received_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      setSubmitted(true);
      toast.success("Thank you for your testimonial!");
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error("Failed to submit testimonial");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-semibold mb-2">Request Not Found</h1>
            <p className="text-muted-foreground">
              This testimonial request link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold mb-2">Thank You!</h1>
            <p className="text-muted-foreground">
              Your testimonial has been submitted successfully. {speakerName && `${speakerName} really appreciates your feedback!`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Share Your Testimonial</CardTitle>
            <CardDescription>
              {speakerName && `${speakerName} would love to hear about your experience`}
              {request?.event_name && ` at ${request.event_name}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Testimonial */}
            <div className="space-y-2">
              <Label htmlFor="quote">Your Testimonial *</Label>
              <Textarea
                id="quote"
                placeholder="Share your experience and feedback..."
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                rows={5}
              />
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

            {/* Author Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="authorName">Your Name *</Label>
                <Input
                  id="authorName"
                  placeholder="John Smith"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authorTitle">Your Title</Label>
                <Input
                  id="authorTitle"
                  placeholder="CEO"
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                />
              </div>
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

            {/* Photo */}
            <div className="space-y-2">
              <Label>Your Photo (optional)</Label>
              <div className="flex items-center gap-4">
                {authorPhotoUrl ? (
                  <img
                    src={authorPhotoUrl}
                    alt="Your photo"
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

            <Button 
              onClick={handleSubmit} 
              disabled={submitting} 
              className="w-full bg-violet-600 hover:bg-violet-700"
              size="lg"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit Testimonial"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
