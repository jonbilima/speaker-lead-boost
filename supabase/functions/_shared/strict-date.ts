/**
 * Strict date parsing for ingested opportunity dates.
 *
 * Rule: we only store a date the source actually stated, down to the day.
 * A bare year ("2027") or a month+year ("March 2027") is NOT a date — the
 * JS Date parser silently turns those into the 1st of a month, which is how
 * invented event dates ended up in the catalogue. Those now return null.
 */

const MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Does the string state an explicit day-of-month (not just a month or a year)? */
export function hasExplicitDay(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // ISO-ish: 2027-03-05, 2027/03/05
  if (/\b(19|20)\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/.test(t)) return true;
  // Numeric: 3/5/2027, 05-03-2027
  if (/\b\d{1,2}[/-]\d{1,2}[/-](19|20)?\d{2}\b/.test(t)) return true;
  // "March 5", "5 March", "Mar. 5th"
  if (new RegExp(`${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i").test(t)) return true;
  if (new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b`, "i").test(t)) return true;
  return false;
}

export function isPlausibleEventYear(d: Date): boolean {
  const y = d.getUTCFullYear();
  const current = new Date().getUTCFullYear();
  return y >= current - 1 && y <= current + 10;
}

/**
 * Parse a date only when the source stated a specific day. Returns an ISO
 * timestamp or null — never a guessed first-of-month.
 */
export function parseExplicitDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (!hasExplicitDay(s)) return null;

  // Ambiguous MM/DD/YYYY vs DD/MM/YYYY: keep the historical US reading.
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\b/);
  if (slash) {
    const iso = `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}T00:00:00Z`;
    const d = new Date(iso);
    if (!isNaN(d.getTime()) && isPlausibleEventYear(d)) return d.toISOString();
  }

  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  if (!isPlausibleEventYear(parsed)) return null;
  return parsed.toISOString();
}
