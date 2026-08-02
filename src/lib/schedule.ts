import { monthDates } from "./dates";

/**
 * BAZAR SCHEDULING ALGORITHM
 * ───────────────────────────
 * Goal: give every member a fair share of the given days, in consecutive
 * blocks matching their preference (default 2 days), in a random order.
 *
 * Example: 31 days, 5 members →
 *   Step 1  base quota = floor(31/5) = 6 days each, remainder 1
 *   Step 2  one randomly-picked member gets the extra day (quota 7)
 *   Step 3  a member with quota 7 & preference 2 → blocks [2, 2, 2, 1]
 *   Step 4  shuffle ALL blocks, lay them over the days in order:
 *           Day 1-2 → Rahim, Day 3-4 → Karim, Day 5-6 → Salma, ...
 *
 * Every day gets exactly one person, quotas differ by at most 1 day,
 * and re-running produces a different random order each time.
 *
 * The same routine powers three features:
 *   - whole-month generation        → generateSchedule(members, month)
 *   - admin custom date ranges      → generateScheduleForDays(members, days)
 *   - fitting a mid-month joiner in → fitNewMember(...) below
 */

export const DEFAULT_BLOCK_SIZE = 2; // blocks of 2 consecutive days by default

export interface MemberPreference {
  userId: string;
  preference: number; // 1 | 2 | 3 | 5 consecutive days
}

export interface ScheduleAssignment {
  date: string; // "YYYY-MM-DD"
  user: string; // userId
}

/** Fisher–Yates shuffle (unbiased, unlike sort(() => Math.random()-0.5)) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Distribute an arbitrary list of days (sorted "YYYY-MM-DD") among members. */
export function generateScheduleForDays(
  members: MemberPreference[],
  days: string[]
): ScheduleAssignment[] {
  if (members.length === 0) {
    throw new Error("Cannot generate a schedule for an empty group");
  }
  if (days.length === 0) return [];

  // Steps 1 & 2 — equal quotas; the remainder goes to random members
  const base = Math.floor(days.length / members.length);
  const remainder = days.length % members.length;
  const luckyOrder = shuffle([...members]);
  const quota = new Map<string, number>();
  luckyOrder.forEach((m, i) => quota.set(m.userId, base + (i < remainder ? 1 : 0)));

  // Step 3 — split each quota into blocks of the member's preferred size
  const blocks: { userId: string; size: number }[] = [];
  for (const m of members) {
    const blockSize = [1, 2, 3, 5].includes(m.preference)
      ? m.preference
      : DEFAULT_BLOCK_SIZE;
    let remaining = quota.get(m.userId)!;
    while (remaining > 0) {
      const size = Math.min(blockSize, remaining); // last block may be smaller
      blocks.push({ userId: m.userId, size });
      remaining -= size;
    }
  }

  // Step 4 — shuffle blocks, then walk through the days in order
  shuffle(blocks);
  const assignments: ScheduleAssignment[] = [];
  let dayIndex = 0;
  for (const block of blocks) {
    for (let k = 0; k < block.size; k++) {
      assignments.push({ date: days[dayIndex++], user: block.userId });
    }
  }

  return assignments;
}

/** Distribute a whole month among members. */
export function generateSchedule(
  members: MemberPreference[],
  month: string
): ScheduleAssignment[] {
  return generateScheduleForDays(members, monthDates(month));
}

/**
 * FIT A NEW MEMBER INTO AN EXISTING SCHEDULE (mid-month join)
 * ────────────────────────────────────────────────────────────
 * The month is already fully assigned, so the newcomer's fair share must
 * come FROM the existing members. Strategy:
 *
 *   1. Look only at days from `fromDate` onward (never touch the past).
 *   2. fair share = floor(remaining days / (existing members + 1))
 *   3. Repeatedly take days from whoever currently holds the MOST
 *      remaining days — from the END of their latest consecutive run, in
 *      chunks of up to `blockSize` (default 2) — and give them to the
 *      new member.
 *
 * Taking from the end of a donor's run keeps THEIR days consecutive, and
 * taking whole chunks gives the NEWCOMER consecutive pairs too.
 *
 * Returns the mutated assignment list plus how many days moved.
 */
export function fitNewMember(
  assignments: ScheduleAssignment[],
  newUserId: string,
  fromDate: string, // first eligible day, e.g. tomorrow
  blockSize = DEFAULT_BLOCK_SIZE
): { assignments: ScheduleAssignment[]; movedDays: number } {
  const future = assignments
    .filter((a) => a.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const holders = new Set(future.map((a) => a.user));
  holders.delete(newUserId); // re-joining user: don't count them twice

  const share = Math.floor(future.length / (holders.size + 1));
  if (share === 0 || holders.size === 0) {
    return { assignments, movedDays: 0 };
  }

  // Count each existing member's remaining days
  const counts = new Map<string, number>();
  for (const a of future) {
    if (a.user !== newUserId) counts.set(a.user, (counts.get(a.user) ?? 0) + 1);
  }

  let need = share;
  while (need > 0) {
    // Donor = the member with the most remaining days
    let donor: string | null = null;
    let max = 0;
    counts.forEach((count, userId) => {
      if (count > max) {
        donor = userId;
        max = count;
      }
    });
    if (!donor || max === 0) break; // nothing left to take

    // The donor's LATEST consecutive run of days
    const donorDays = future
      .filter((a) => a.user === donor)
      .map((a) => a.date)
      .sort();
    let runStart = donorDays.length - 1;
    while (
      runStart > 0 &&
      isNextDay(donorDays[runStart - 1], donorDays[runStart])
    ) {
      runStart--;
    }
    const run = donorDays.slice(runStart);

    // Transfer up to blockSize days from the end of that run
    const take = Math.min(blockSize, need, run.length);
    const taken = run.slice(run.length - take);
    for (const a of future) {
      if (a.user === donor && taken.includes(a.date)) a.user = newUserId;
    }
    counts.set(donor, (counts.get(donor) ?? 0) - take);
    need -= take;
  }

  return { assignments, movedDays: share - need };
}

/** Are two "YYYY-MM-DD" strings consecutive calendar days? */
function isNextDay(a: string, b: string): boolean {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1) === 86_400_000;
}
