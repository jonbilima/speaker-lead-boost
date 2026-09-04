import { useEffect, useRef, useState } from "react";
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
import { ChangeEmailDialog } from "@/components/settings/ChangeEmailDialog";
import { InvoiceSettingsSection } from "@/components/settings/InvoiceSettingsSection";
import { ConnectedAccountsSection } from "@/components/settings/ConnectedAccountsSection";
import { EmailDigestPreferences } from "@/components/settings/EmailDigestPreferences";
import { TrackingKeywordsSection } from "@/components/settings/TrackingKeywordsSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { TopicSelector } from "@/components/profile/TopicSelector";
import { VerticalSelector } from "@/components/profile/VerticalSelector";
import { useVerticals } from "@/hooks/useVerticals";
import { rescoreMatches } from "@/lib/rescoreMatches";

/**
 * Fields that actually feed score_opportunities_for_user:
 *   - profiles.fee_range_min  (fee_alignment_score)
 *   - user_topics             (topic_match_score)
 * Nothing else in this form affects a score, so nothing else should trigger a
 * full rescore of every active opportunity. fee_range_max, bio, links, and
 * follow-up intervals are deliberately excluded.
 */
type ScoringInputs = { feeRangeMin: string; topics: string[] };

const scoringInputsChanged = (a: ScoringInputs, b: ScoringInputs): boolean => {
  if (a.feeRangeMin.trim() !== b.feeRangeMin.trim()) return true;
  const sortedA = [...a.topics].sort().join(",");
  const sortedB = [...b.topics].sort().join(",");
  return sortedA !== sortedB;
};

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [allTopics, setAllTopics] = useState<{ id: string; name: string; category?: string }[]>([]);
  const navigate = useNavigate();
  const {
    verticals,
    selected: selectedVerticals,
    toggle: toggleVertical,
    save: saveVerticals,
    hasChanged: verticalsChanged,
  } = useVerticals(userId);

  // Snapshot of the scoring-relevant fields as last persisted, used to decide
  // whether a save needs to trigger a rescore at all.
  const savedScoringInputs = useRef<ScoringInputs>({ feeRangeMin: "1000", topics: [] });

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
        const loadedTopics = profile.user_topics?.map((ut: any) => ut.topic_id) || [];
        const loadedFeeMin = profile.fee_range_min?.toString() || "1000";
        savedScoringInputs.current = { feeRangeMin: loadedFeeMin, topics: loadedTopics };
        setFormData({
          name: profile.name || "",
          email: session.user.email || "",
          bio: profile.bio || "",
          selectedTopics: loadedTopics,
          customTopics: (profile as any).custom_topics || [],
          feeRangeMin: loadedFeeMin,
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

      // Decide up front whether this save can change any match score.
      const needsRescore = scoringInputsChanged(savedScoringInputs.current, {
        feeRangeMin: formData.feeRangeMin,
        topics: formData.selectedTopics,
      }) || verticalsChanged();

      if (selectedVerticals.length === 0) {
        toast.error("Select at least one audience you speak to");
        setSaving(false);
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

      const verticalsSaved = await saveVerticals();
      if (!verticalsSaved) {
        toast.error("Couldn't save your audience selection. Please try again.");
        return;
      }

      savedScoringInputs.current = {
        feeRangeMin: formData.feeRangeMin,
        topics: [...formData.selectedTopics],
      };

      if (!needsRescore) {
        // Nothing that feeds the score changed (e.g. bio, LinkedIn URL) — skip
        // the rescore entirely instead of recomputing every active opportunity.
        toast.success("Profile saved");
        navigate("/dashboard");
        return;
      }

      toast.success("Profile saved! Updating your matches...");

      // Recalculate match scores now (fast, deterministic) and surface real errors
      const scored = await rescoreMatches({ silent: true });

      if (scored === null) {
        toast.error("Profile saved, but we couldn't update your matches. Try saving again.");
      } else {
        toast.success(`Matches updated — ${scored} opportunities rescored`);
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
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="flex-1"
                    />
                    <ChangeEmailDialog currentEmail={formData.email} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is your sign-in address. Changing it sends a
                    confirmation link to the new address.
                  </p>
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

              <div className="space-y-2 pt-2 border-t">
                <VerticalSelector
                  verticals={verticals}
                  selected={selectedVerticals}
                  onToggle={toggleVertical}
                  disabled={saving}
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
                disabled={
                  saving ||
                  selectedVerticals.length === 0 ||
                  (formData.selectedTopics.length === 0 && formData.customTopics.length === 0)
                }
              >
                {saving ? "Saving..." : "Save Profile & Find Opportunities"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <AppearanceSection />

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
