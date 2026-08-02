/**
 * DATE HELPERS — all business dates are "YYYY-MM-DD" strings
 * ────────────────────────────────────────────────────────────
 * The app runs on a server whose clock is UTC, but the group lives in
 * APP_TIMEZONE (e.g. Asia/Dhaka). "Today" in Dhaka can be a different
 * calendar day than "today" in UTC! These helpers always answer in the
 * group's timezone, using the built-in Intl API (no date libraries needed).
 *
 * Handy trick: the "en-CA" (Canadian English) locale formats dates as
 * YYYY-MM-DD out of the box — exactly our storage format.
 */

const tz = () => process.env.APP_TIMEZONE || "Asia/Dhaka";

/** Today's date in the group's timezone → "2026-08-01" */
export function todayInAppTz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(new Date());
}

/** Convert any Date (e.g. a member's joinedAt) to "YYYY-MM-DD" in group time */
export function dateStrInAppTz(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(d);
}

/** Current hour (0–23) in the group's timezone — used for the meal cutoff */
export function currentHourInAppTz(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz(),
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
}

/** Current month → "2026-08" */
export function currentMonth(): string {
  return todayInAppTz().slice(0, 7);
}

/** How many days are in "2026-08"? → 31. (Month 0 trick: day 0 of the NEXT month is the last day of this one.) */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Every date string of a month, in order: ["2026-08-01", ..., "2026-08-31"] */
export function monthDates(month: string): string[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    return `${month}-${String(i + 1).padStart(2, "0")}`;
  });
}

/** "2026-08-31" + 1 day → "2026-09-01" (UTC math on plain strings, so no timezone drift) */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "2026-08-15" → "2026-08" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** First day of a month: "2026-08" → "2026-08-01" */
export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

/** Last day of a month: "2026-08" → "2026-08-31" */
export function lastDayOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/** "2026-08" → "2026-09" (wraps the year: "2026-12" → "2027-01") */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // month is 0-indexed → m IS next month
  return next.toISOString().slice(0, 7);
}

/** The smaller of two "YYYY-MM-DD" strings (they compare alphabetically) */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** The larger of two "YYYY-MM-DD" strings */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}
