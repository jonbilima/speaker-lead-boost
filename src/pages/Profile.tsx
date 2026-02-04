import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmailSettingsSection } from "@/components/settings/EmailSettingsSection";
import { InvoiceSettingsSection } from "@/components/settings/InvoiceSettingsSection";
import { ConnectedAccountsSection } from "@/components/settings/ConnectedAccountsSection";
import { EmailDigestPreferences } from "@/components/settings/EmailDigestPreferences";
import { TrackingKeywordsSection } from "@/components/settings/TrackingKeywordsSection";
import { TopicSelector } from "@/components/profile/TopicSelector";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [allTopics, setAllTopics] = useState<{ id: string; name: string; category?: string }[]>([]);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
    selectedTopics: [] as string[],
    customTopics: [] as string[],
    feeRangeMin: "1000",
    feeRangeMax: "50000",
    pastTalks: "",
    linkedinUrl: "",
    twitterUrl: "",
    followUpInterval1: "7",
    followUpInterval2: "14",
    followUpInterval3: "21",
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Load all available topics with categories
      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, name, category')
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
          customTopics: (profile as any).custom_topics || [],
          feeRangeMin: profile.fee_range_min?.toString() || "1000",
          feeRangeMax: profile.fee_range_max?.toString() || "50000",
          pastTalks: profile.past_talks?.join('\n') || "",
          linkedinUrl: profile.linkedin_url || "",
          twitterUrl: profile.twitter_url || "",
          followUpInterval1: profile.follow_up_interval_1?.toString() || "7",
          followUpInterval2: profile.follow_up_interval_2?.toString() || "14",
          followUpInterval3: profile.follow_up_interval_3?.toString() || "21",
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

  const handleAddCustomTopic = (topic: string) => {
    setFormData(prev => ({
      ...prev,
      customTopics: [...prev.customTopics, topic]
    }));
  };

  const handleRemoveCustomTopic = (topic: string) => {
    setFormData(prev => ({
      ...prev,
      customTopics: prev.customTopics.filter(t => t !== topic)
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
          follow_up_interval_1: parseInt(formData.followUpInterval1),
          follow_up_interval_2: parseInt(formData.followUpInterval2),
          follow_up_interval_3: parseInt(formData.followUpInterval3),
          custom_topics: formData.customTopics,
        } as any)
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
    return null; // AppLayout handles loading state
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Speaker Profile</h1>
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
                <TopicSelector
                  allTopics={allTopics.map(t => ({ ...t, category: (t as any).category }))}
                  selectedTopicIds={formData.selectedTopics}
                  customTopics={formData.customTopics}
                  onToggleTopic={handleTopicToggle}
                  onAddCustomTopic={handleAddCustomTopic}
                  onRemoveCustomTopic={handleRemoveCustomTopic}
                />
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

              {/* Follow-up Reminder Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="text-base font-medium">Follow-up Reminder Intervals</Label>
                  <p className="text-sm text-muted-foreground">
                    Customize when you want to be reminded to follow up after applying
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="followUpInterval1">1st Follow-up (days)</Label>
                    <Input
                      id="followUpInterval1"
                      type="number"
                      value={formData.followUpInterval1}
                      onChange={(e) => setFormData({ ...formData, followUpInterval1: e.target.value })}
                      min="1"
                      max="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followUpInterval2">2nd Follow-up (days)</Label>
                    <Input
                      id="followUpInterval2"
                      type="number"
                      value={formData.followUpInterval2}
                      onChange={(e) => setFormData({ ...formData, followUpInterval2: e.target.value })}
                      min="1"
                      max="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followUpInterval3">Final Follow-up (days)</Label>
                    <Input
                      id="followUpInterval3"
                      type="number"
                      value={formData.followUpInterval3}
                      onChange={(e) => setFormData({ ...formData, followUpInterval3: e.target.value })}
                      min="1"
                      max="90"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={saving || (formData.selectedTopics.length === 0 && formData.customTopics.length === 0)}
              >
                {saving ? "Saving..." : "Save Profile & Find Opportunities"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <ConnectedAccountsSection />

        {/* Weekly Digest Preferences */}
        {userId && <EmailDigestPreferences userId={userId} />}

        {/* Tracking Keywords for Opportunity Alerts */}
        {userId && (
          <TrackingKeywordsSection 
            speakerId={userId} 
            userTopics={allTopics.filter(t => formData.selectedTopics.includes(t.id)).map(t => t.name)} 
          />
        )}

        {/* Email Settings */}
        {userId && <EmailSettingsSection userId={userId} />}

        {/* Invoice Settings */}
        {userId && <InvoiceSettingsSection userId={userId} />}
      </div>
    </AppLayout>
  );
};

export default Profile;
