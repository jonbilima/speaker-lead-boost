import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allTopics, setAllTopics] = useState<{ id: string; name: string }[]>([]);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
    selectedTopics: [] as string[],
    feeRangeMin: "1000",
    feeRangeMax: "50000",
    pastTalks: "",
    linkedinUrl: "",
    twitterUrl: "",
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load all available topics
      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, name')
        .order('name');
      
      if (topicsData) {
        setAllTopics(topicsData);
      }

      // Load existing profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, user_topics(topic_id)')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setFormData({
          name: profile.name || "",
          email: session.user.email || "",
          bio: profile.bio || "",
          selectedTopics: profile.user_topics?.map((ut: any) => ut.topic_id) || [],
          feeRangeMin: profile.fee_range_min?.toString() || "1000",
          feeRangeMax: profile.fee_range_max?.toString() || "50000",
          pastTalks: profile.past_talks?.join('\n') || "",
          linkedinUrl: profile.linkedin_url || "",
          twitterUrl: profile.twitter_url || "",
        });
      } else {
        setFormData(prev => ({ ...prev, email: session.user.email || "" }));
      }

      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleTopicToggle = (topicId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topicId)
        ? prev.selectedTopics.filter(id => id !== topicId)
        : [...prev.selectedTopics, topicId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired");
        navigate("/auth");
        return;
      }

      // Save profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          bio: formData.bio,
          fee_range_min: parseInt(formData.feeRangeMin),
          fee_range_max: parseInt(formData.feeRangeMax),
          past_talks: formData.pastTalks.split('\n').filter(t => t.trim()),
          linkedin_url: formData.linkedinUrl,
          twitter_url: formData.twitterUrl,
        })
        .eq('id', session.user.id);

      if (profileError) throw profileError;

      // Delete existing topics
      await supabase
        .from('user_topics')
        .delete()
        .eq('user_id', session.user.id);

      // Insert new topics
      if (formData.selectedTopics.length > 0) {
        const { error: topicsError } = await supabase
          .from('user_topics')
          .insert(
            formData.selectedTopics.map(topicId => ({
              user_id: session.user.id,
              topic_id: topicId,
            }))
          );

        if (topicsError) throw topicsError;
      }

      toast.success("Profile saved! Finding opportunities for you...");

      // Trigger opportunity ranking
      const { error: rankError } = await supabase.functions.invoke('rank-opportunities', {
        body: { user_id: session.user.id }
      });

      if (rankError) {
        console.error('Ranking error:', rankError);
        toast.info("Profile saved, but ranking will happen later");
      }

      navigate("/dashboard");
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center">
            <Logo size="md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Speaker Profile</h1>
          <p className="text-muted-foreground">
            Tell us about yourself to get better opportunities
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>
              This helps us match you with the right speaking gigs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about your speaking experience..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Speaking Topics * (select at least one)</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-muted/20">
                  {allTopics.map(topic => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleTopicToggle(topic.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        formData.selectedTopics.includes(topic.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-border hover:bg-muted'
                      }`}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="feeRangeMin">Minimum Fee ($)</Label>
                  <Input
                    id="feeRangeMin"
                    type="number"
                    value={formData.feeRangeMin}
                    onChange={(e) => setFormData({ ...formData, feeRangeMin: e.target.value })}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feeRangeMax">Maximum Fee ($)</Label>
                  <Input
                    id="feeRangeMax"
                    type="number"
                    value={formData.feeRangeMax}
                    onChange={(e) => setFormData({ ...formData, feeRangeMax: e.target.value })}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pastTalks">Past Talk Titles</Label>
                <Textarea
                  id="pastTalks"
                  placeholder="List your notable past talks (one per line)"
                  value={formData.pastTalks}
                  onChange={(e) => setFormData({ ...formData, pastTalks: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterUrl">Twitter/X URL</Label>
                  <Input
                    id="twitterUrl"
                    type="url"
                    placeholder="https://x.com/..."
                    value={formData.twitterUrl}
                    onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-accent to-primary"
                disabled={saving || formData.selectedTopics.length === 0}
              >
                {saving ? "Saving..." : "Save Profile & Find Opportunities"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
