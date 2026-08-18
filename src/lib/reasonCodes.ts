export type ReasonTone = "positive" | "negative" | "neutral" | "missing";

export interface ReasonMeta {
  label: string;
  tone: ReasonTone;
}

export const REASON_CODE_META: Record<string, ReasonMeta> = {
  topic_match_strong: { label: "Matches your topics", tone: "positive" },
  topic_match_none: { label: "Topics don't overlap with yours", tone: "negative" },
  no_topics_tagged: { label: "No topics listed for this event yet", tone: "missing" },
  speaker_topics_missing: { label: "Add topics to your profile to improve matching", tone: "missing" },
  fee_above_floor: { label: "Fee meets your minimum", tone: "positive" },
  fee_below_floor: { label: "Fee below your minimum", tone: "negative" },
  fee_not_listed: { label: "No fee listed", tone: "missing" },
  fee_floor_not_set: { label: "Set a fee floor in your profile", tone: "missing" },
  deadline_tight: { label: "Deadline within 7 days", tone: "neutral" },
  deadline_comfortable: { label: "Deadline still open", tone: "positive" },
  no_deadline_listed: { label: "No deadline listed", tone: "missing" },
  public_cfp: { label: "Open call for speakers", tone: "positive" },
  cold_pitch_required: { label: "Requires a cold pitch", tone: "neutral" },
};

export function describeReasonCodes(codes: string[] | null | undefined): ReasonMeta[] {
  if (!codes?.length) return [];
  return codes
    .map((code) => REASON_CODE_META[code])
    .filter((meta): meta is ReasonMeta => Boolean(meta));
}

/** True when a low score is driven by absent data rather than a genuine mismatch. */
export function isMissingDataScore(codes: string[] | null | undefined): boolean {
  if (!codes?.length) return false;
  const hasRealMismatch = codes.includes("topic_match_none") || codes.includes("fee_below_floor");
  const hasMissing = codes.some((c) => REASON_CODE_META[c]?.tone === "missing");
  return hasMissing && !hasRealMismatch;
}

/** Short phrases used to lead a generated pitch (shared with the generate-pitch function). */
export const REASON_CODE_PITCH_HINTS: Record<string, string> = {
  topic_match_strong: "the speaker's core topics directly match this event's stated topics",
  topic_match_none: "the event topics differ, so lead with transferable expertise",
  no_topics_tagged: "the event has no topics listed, so lead with the speaker's strongest theme",
  fee_above_floor: "the listed fee fits the speaker's range",
  fee_below_floor: "do not mention fee",
  fee_not_listed: "do not mention fee",
  deadline_tight: "the deadline is imminent, so be brief and direct",
  deadline_comfortable: "there is time, so a warm introduction works",
  no_deadline_listed: "no deadline is listed",
  public_cfp: "this is an open call for speakers",
  cold_pitch_required: "this is a cold outreach with no public call",
};
