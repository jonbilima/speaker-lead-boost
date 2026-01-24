import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, CheckCircle2, Linkedin, Twitter, Youtube, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackData {
  id: string;
  event_name: string;
  event_date: string | null;
  speaker_name: string;
  submitted_at: string | null;
}

export default function FeedbackForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [speakerLinks, setSpeakerLinks] = useState<{
    linkedin_url?: string;
    twitter_url?: string;
    youtube_url?: string;
  }>({});
  const { toast } = useToast();

  const [form, setForm] = useState({
    respondentName: "",
    respondentRole: "organizer",
    overallRating: 0,
    contentRating: 0,
    deliveryRating: 0,
    engagementRating: 0,
    wouldRecommend: true,
    whatWorkedWell: "",
    whatToImprove: "",
    testimonialQuote: "",
    canUseAsTestimonial: false,
  });

  useEffect(() => {
    if (token) {
      fetchFeedbackData();
      trackOpen();
    }
  }, [token]);

  const fetchFeedbackData = async () => {
    try {
      const { data, error } = await supabase.rpc("get_feedback_by_token", {
        p_token: token,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setFeedbackData(data[0]);
        if (data[0].submitted_at) {
          setSubmitted(true);
        }
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    } finally {
      setLoading(false);
    }
  };

  const trackOpen = async () => {
    try {
      await supabase
        .from("feedback_requests")
        .update({ opened_at: new Date().toISOString(), status: "opened" })
        .eq("token", token);
    } catch (error) {
      console.error("Error tracking open:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.overallRating === 0) {
      toast({ title: "Please provide an overall rating", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-feedback", {
        body: { token, ...form },
      });

      if (error) throw error;

      setSubmitted(true);
      if (data.speaker) {
        setSpeakerLinks(data.speaker);
      }
      toast({ title: "Thank you for your feedback!" });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({ title: "Error submitting feedback", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            <Star
              className={`h-8 w-8 ${
                star <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!feedbackData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">
              This feedback link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-muted-foreground">
                Your feedback has been submitted successfully.
              </p>
            </div>
            
            {(speakerLinks.linkedin_url || speakerLinks.twitter_url || speakerLinks.youtube_url) && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect with {feedbackData.speaker_name}:
                </p>
                <div className="flex justify-center gap-4">
                  {speakerLinks.linkedin_url && (
                    <a
                      href={speakerLinks.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-[#0077b5] text-white hover:opacity-90 transition-opacity"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  )}
                  {speakerLinks.twitter_url && (
                    <a
                      href={speakerLinks.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-[#1da1f2] text-white hover:opacity-90 transition-opacity"
                    >
                      <Twitter className="h-5 w-5" />
                    </a>
                  )}
                  {speakerLinks.youtube_url && (
                    <a
                      href={speakerLinks.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-[#ff0000] text-white hover:opacity-90 transition-opacity"
                    >
                      <Youtube className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="text-4xl mb-2">📝</div>
            <CardTitle className="text-xl">How was {feedbackData.speaker_name}?</CardTitle>
            <p className="text-muted-foreground">
              {feedbackData.event_name}
              {feedbackData.event_date && (
                <span> • {new Date(feedbackData.event_date).toLocaleDateString()}</span>
              )}
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Your Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    value={form.respondentName}
                    onChange={(e) => setForm({ ...form, respondentName: e.target.value })}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <Label>Your Role</Label>
                  <RadioGroup
                    value={form.respondentRole}
                    onValueChange={(v) => setForm({ ...form, respondentRole: v })}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="organizer" id="organizer" />
                      <Label htmlFor="organizer" className="cursor-pointer">Organizer</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="attendee" id="attendee" />
                      <Label htmlFor="attendee" className="cursor-pointer">Attendee</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="host" id="host" />
                      <Label htmlFor="host" className="cursor-pointer">Host</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Ratings */}
              <div className="space-y-4 pt-4 border-t">
                <StarRating
                  label="Overall Experience *"
                  value={form.overallRating}
                  onChange={(v) => setForm({ ...form, overallRating: v })}
                />
                <StarRating
                  label="Content Quality"
                  value={form.contentRating}
                  onChange={(v) => setForm({ ...form, contentRating: v })}
                />
                <StarRating
                  label="Delivery & Presentation"
                  value={form.deliveryRating}
                  onChange={(v) => setForm({ ...form, deliveryRating: v })}
                />
                <StarRating
                  label="Audience Engagement"
                  value={form.engagementRating}
                  onChange={(v) => setForm({ ...form, engagementRating: v })}
                />
              </div>

              {/* Would Recommend */}
              <div className="pt-4 border-t">
                <Label>Would you recommend this speaker?</Label>
                <RadioGroup
                  value={form.wouldRecommend ? "yes" : "no"}
                  onValueChange={(v) => setForm({ ...form, wouldRecommend: v === "yes" })}
                  className="flex gap-6 mt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="recommend-yes" />
                    <Label htmlFor="recommend-yes" className="cursor-pointer">Yes, definitely!</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="recommend-no" />
                    <Label htmlFor="recommend-no" className="cursor-pointer">Not sure</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Text Feedback */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="worked-well">What worked well?</Label>
                  <Textarea
                    id="worked-well"
                    value={form.whatWorkedWell}
                    onChange={(e) => setForm({ ...form, whatWorkedWell: e.target.value })}
                    placeholder="What did you like most about the presentation?"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="improve">What could be improved?</Label>
                  <Textarea
                    id="improve"
                    value={form.whatToImprove}
                    onChange={(e) => setForm({ ...form, whatToImprove: e.target.value })}
                    placeholder="Any suggestions for improvement?"
                    rows={3}
                  />
                </div>
              </div>

              {/* Testimonial */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="testimonial"
                    checked={form.canUseAsTestimonial}
                    onCheckedChange={(v) => setForm({ ...form, canUseAsTestimonial: v as boolean })}
                  />
                  <Label htmlFor="testimonial" className="cursor-pointer leading-relaxed">
                    I'm happy for my feedback to be used as a public testimonial
                  </Label>
                </div>
                
                {form.canUseAsTestimonial && (
                  <div>
                    <Label htmlFor="quote">Brief quote we can use</Label>
                    <Textarea
                      id="quote"
                      value={form.testimonialQuote}
                      onChange={(e) => setForm({ ...form, testimonialQuote: e.target.value })}
                      placeholder="A short quote summarizing your experience..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
