/**
 * Opportunity dates are stored as midnight UTC timestamps that stand for a
 * calendar day, not a moment in time. Rendering them with the browser's local
 * clock shifts them back a day for every viewer west of UTC (March 1 shows as
 * February 28 in the US). These helpers read the UTC calendar parts so a stored
 * day always prints as that day, wherever the speaker is.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type DateStyle = "short" | "medium" | "long";

const OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: "short", day: "numeric", timeZone: "UTC" },
  medium: { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  long: { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
};

/** Format a stored event date / deadline as its own calendar day. */
export function formatEventDate(
  value: string | null | undefined,
  style: DateStyle = "medium",
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", OPTIONS[style]).format(date);
}

/** Same, with a caller-supplied fallback instead of null. */
export function formatEventDateOr(
  value: string | null | undefined,
  fallback: string,
  style: DateStyle = "medium",
): string {
  return formatEventDate(value, style) ?? fallback;
}

/**
 * Whole days between today and a stored calendar day, both read in UTC.
 * Positive = still ahead, 0 = today, negative = passed.
 */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / MS_PER_DAY);
}

/** A call is closed once its deadline day is behind us. */
export function isDeadlinePassed(deadline: string | null | undefined): boolean {
  const days = daysUntil(deadline);
  return days !== null && days < 0;
}
