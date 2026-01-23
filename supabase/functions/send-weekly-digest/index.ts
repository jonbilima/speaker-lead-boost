import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface DigestData {
  newMatches: Array<{ name: string; deadline: string; score: number }>;
  upcomingDeadlines: Array<{ name: string; deadline: string }>;
  overdueFollowUps: Array<{ name: string; dueDate: string }>;
  pipelineCounts: Record<string, number>;
  trendingTopics: Array<{ name: string; count: number; trend: string }>;
}

function getDayOfWeek(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getUTCDay()];
}

function getCurrentHour(): number {
  return new Date().getUTCHours();
}

async function gatherDigestData(supabase: any, userId: string): Promise<DigestData> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  // Get new matches from last week
  const { data: newMatches } = await supabase
    .from('opportunity_scores')
    .select(`
      ai_score,
      opportunities (
        name,
        deadline
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString())
    .order('ai_score', { ascending: false })
    .limit(5);

  // Get upcoming deadlines
  const { data: deadlines } = await supabase
    .from('opportunity_scores')
    .select(`
      opportunities (
        name,
        deadline
      )
    `)
    .eq('user_id', userId)
    .not('opportunities.deadline', 'is', null)
    .lte('opportunities.deadline', twoWeeksFromNow.toISOString())
    .gte('opportunities.deadline', new Date().toISOString())
    .order('opportunities(deadline)', { ascending: true })
    .limit(5);

  // Get overdue follow-ups
  const { data: followUps } = await supabase
    .from('follow_up_reminders')
    .select(`
      due_date,
      opportunity_scores (
        opportunities (
          name
        )
      )
    `)
    .eq('user_id', userId)
    .eq('is_completed', false)
    .lt('due_date', new Date().toISOString())
    .limit(5);

  // Get pipeline counts
  const { data: pipelineData } = await supabase
    .from('opportunity_scores')
    .select('stage')
    .eq('user_id', userId);

  const pipelineCounts: Record<string, number> = {};
  pipelineData?.forEach((item: any) => {
    const stage = item.stage || 'matched';
    pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
  });

  // Get trending topics
  const { data: topicCounts } = await supabase
    .from('opportunity_topics')
    .select(`
      topics (
        name
      )
    `)
    .limit(100);

  const topicFrequency: Record<string, number> = {};
  topicCounts?.forEach((item: any) => {
    const name = item.topics?.name;
    if (name) {
      topicFrequency[name] = (topicFrequency[name] || 0) + 1;
    }
  });

  const trendingTopics = Object.entries(topicFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ 
      name, 
      count, 
      trend: count > 5 ? '🔥' : '📈' 
    }));

  return {
    newMatches: (newMatches || []).map((m: any) => ({
      name: m.opportunities?.name || 'Unknown',
      deadline: m.opportunities?.deadline || '',
      score: m.ai_score || 0,
    })),
    upcomingDeadlines: (deadlines || []).map((d: any) => ({
      name: d.opportunities?.name || 'Unknown',
      deadline: d.opportunities?.deadline || '',
    })),
    overdueFollowUps: (followUps || []).map((f: any) => ({
      name: f.opportunity_scores?.opportunities?.name || 'Unknown',
      dueDate: f.due_date || '',
    })),
    pipelineCounts,
    trendingTopics,
  };
}

function generateEmailHtml(
  speakerName: string, 
  data: DigestData, 
  preferences: any,
  trackingId: string,
  baseUrl: string
): string {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  let sections = '';

  // New Matches Section
  if (preferences.include_new_matches && data.newMatches.length > 0) {
    sections += `
      <tr>
        <td style="padding: 24px;">
          <h2 style="color: #7c3aed; margin: 0 0 16px 0; font-size: 18px;">
            🎯 ${data.newMatches.length} New Opportunities Match Your Profile
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${data.newMatches.slice(0, 3).map(match => `
              <tr>
                <td style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                  <strong style="color: #1e293b;">${match.name}</strong>
                  <br/>
                  <span style="color: #64748b; font-size: 14px;">
                    Deadline: ${formatDate(match.deadline)} • Match Score: ${match.score}%
                  </span>
                </td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    `;
  }

  // Deadlines Section
  if (preferences.include_deadlines && data.upcomingDeadlines.length > 0) {
    sections += `
      <tr>
        <td style="padding: 24px; background: #fef3c7;">
          <h2 style="color: #92400e; margin: 0 0 16px 0; font-size: 18px;">
            ⏰ Deadlines Coming Up
          </h2>
          <ul style="margin: 0; padding-left: 20px; color: #78350f;">
            ${data.upcomingDeadlines.map(d => `
              <li style="margin-bottom: 8px;">
                <strong>${d.name}</strong> - ${formatDate(d.deadline)}
              </li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  // Follow-ups Section
  if (preferences.include_follow_ups && data.overdueFollowUps.length > 0) {
    sections += `
      <tr>
        <td style="padding: 24px; background: #fee2e2;">
          <h2 style="color: #991b1b; margin: 0 0 16px 0; font-size: 18px;">
            📧 Don't Forget to Follow Up
          </h2>
          <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
            ${data.overdueFollowUps.map(f => `
              <li style="margin-bottom: 8px;">
                <strong>${f.name}</strong> - Due: ${formatDate(f.dueDate)}
              </li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  // Pipeline Summary Section
  if (preferences.include_pipeline_summary && Object.keys(data.pipelineCounts).length > 0) {
    const stageLabels: Record<string, string> = {
      matched: '🎯 Matched',
      researching: '🔍 Researching',
      applied: '📤 Applied',
      in_conversation: '💬 In Conversation',
      accepted: '✅ Accepted',
      rejected: '❌ Rejected',
    };

    sections += `
      <tr>
        <td style="padding: 24px;">
          <h2 style="color: #7c3aed; margin: 0 0 16px 0; font-size: 18px;">
            📊 Your Pipeline
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${Object.entries(data.pipelineCounts).map(([stage, count]) => `
                <td style="text-align: center; padding: 16px; background: #f1f5f9; border-radius: 8px; margin: 4px;">
                  <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${count}</div>
                  <div style="font-size: 12px; color: #64748b;">${stageLabels[stage] || stage}</div>
                </td>
              `).join('')}
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // Trending Topics Section
  if (preferences.include_market_insights && data.trendingTopics.length > 0) {
    sections += `
      <tr>
        <td style="padding: 24px; background: #f0fdf4;">
          <h2 style="color: #166534; margin: 0 0 16px 0; font-size: 18px;">
            📈 Trending This Week
          </h2>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${data.trendingTopics.map(t => `
              <span style="background: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 16px; font-size: 14px;">
                ${t.trend} ${t.name} (${t.count})
              </span>
            `).join(' ')}
          </div>
        </td>
      </tr>
    `;
  }

  // Tracking pixel URL
  const trackingPixel = `${baseUrl}/functions/v1/track-email-open?id=${trackingId}`;
  const dashboardUrl = `${baseUrl.replace('.supabase.co', '')}/dashboard?ref=${trackingId}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table style="width: 100%; max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; margin-top: 24px; margin-bottom: 24px;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎤 nextmic</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Your Weekly Speaker Briefing</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding: 24px;">
            <h2 style="color: #1e293b; margin: 0;">Hey ${speakerName}! 👋</h2>
            <p style="color: #64748b; margin: 8px 0 0 0;">
              Here's what's happening in your speaking world this week.
            </p>
          </td>
        </tr>

        ${sections}

        <!-- CTA -->
        <tr>
          <td style="padding: 24px; text-align: center;">
            <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Your Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 24px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              You're receiving this because you subscribed to weekly digests.
              <br/>
              <a href="${baseUrl.replace('.supabase.co', '')}/profile?unsubscribe=true" style="color: #7c3aed;">
                Unsubscribe
              </a> or <a href="${baseUrl.replace('.supabase.co', '')}/profile" style="color: #7c3aed;">
                Update preferences
              </a>
            </p>
          </td>
        </tr>
      </table>
      
      <!-- Tracking Pixel -->
      <img src="${trackingPixel}" width="1" height="1" style="display: none;" alt="" />
    </body>
    </html>
  `;
}

async function sendDigestToUser(supabase: any, user: any, preferences: any, baseUrl: string): Promise<void> {
  const digestData = await gatherDigestData(supabase, user.id);
  
  // Check if there's anything to send
  const hasContent = 
    (preferences.include_new_matches && digestData.newMatches.length > 0) ||
    (preferences.include_deadlines && digestData.upcomingDeadlines.length > 0) ||
    (preferences.include_follow_ups && digestData.overdueFollowUps.length > 0) ||
    (preferences.include_pipeline_summary && Object.keys(digestData.pipelineCounts).length > 0) ||
    (preferences.include_market_insights && digestData.trendingTopics.length > 0);

  if (!hasContent) {
    console.log(`No content for user ${user.id}, skipping`);
    return;
  }

  // Create log entry first to get tracking ID
  const { data: logEntry, error: logError } = await supabase
    .from('email_digest_logs')
    .insert({
      speaker_id: user.id,
    })
    .select('id')
    .single();

  if (logError) {
    console.error('Error creating log:', logError);
    return;
  }

  const trackingId = logEntry.id;
  const speakerName = user.name || 'Speaker';
  const emailHtml = generateEmailHtml(speakerName, digestData, preferences, trackingId, baseUrl);

  // Get user email from auth
  const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
  const userEmail = authUser?.user?.email;

  if (!userEmail) {
    console.error(`No email for user ${user.id}`);
    return;
  }

  try {
    const emailResponse = await resend.emails.send({
      from: "nextmic <digest@nextmic.io>",
      to: [userEmail],
      subject: `🎤 Your Weekly Speaker Briefing - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html: emailHtml,
    });

    // Update log with email ID if available
    const emailId = emailResponse?.data?.id;
    if (emailId) {
      await supabase
        .from('email_digest_logs')
        .update({ email_id: emailId })
        .eq('id', trackingId);
    }

    console.log(`Digest sent to ${userEmail}`);
  } catch (error) {
    console.error(`Error sending to ${userEmail}:`, error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { userId, isTest } = body;

    // Test mode: send to specific user
    if (isTest && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data: preferences } = await supabase
        .from('email_digest_preferences')
        .select('*')
        .eq('speaker_id', userId)
        .single();

      if (!profile || !preferences) {
        return new Response(
          JSON.stringify({ error: 'Profile or preferences not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await sendDigestToUser(supabase, profile, preferences, supabaseUrl);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Test digest sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cron mode: check all users and send digests
    const currentDay = getDayOfWeek();
    const currentHour = getCurrentHour();
    const timeWindow = `${currentHour.toString().padStart(2, '0')}:00:00`;

    console.log(`Checking digests for ${currentDay} at ${timeWindow}`);

    // Get all users who should receive digest now
    const { data: eligiblePrefs } = await supabase
      .from('email_digest_preferences')
      .select(`
        *,
        profiles (
          id,
          name
        )
      `)
      .eq('is_enabled', true)
      .eq('send_day', currentDay)
      .eq('send_time', timeWindow);

    if (!eligiblePrefs || eligiblePrefs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No digests to send at this time', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if digest was already sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sentCount = 0;
    for (const pref of eligiblePrefs) {
      const { data: existingLog } = await supabase
        .from('email_digest_logs')
        .select('id')
        .eq('speaker_id', pref.speaker_id)
        .gte('sent_at', today.toISOString())
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        console.log(`Already sent digest to ${pref.speaker_id} today`);
        continue;
      }

      await sendDigestToUser(supabase, pref.profiles, pref, supabaseUrl);
      sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${sentCount} digests`, count: sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
