import { Types } from "mongoose";
import { ApiError } from "./api";
import {
  currentMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  minDate,
  todayInAppTz,
} from "./dates";
import Group, { type IGroup } from "@/models/Group";
import type { HydratedDocument } from "mongoose";

/**
 * MEAL SYSTEM LIFECYCLE
 * ──────────────────────
 * Every month a group's meal system moves through one cycle:
 *
 *   ACTIVE ──(admin freezes)──▶ FROZEN ──(admin hard-resets)──▶ ACTIVE
 *      ▲                                                          │
 *      └──────────(new month begins → automatic reset)────────────┘
 *
 * The automatic reset is LAZY: `ensureCurrentCycle()` runs at the top of
 * every route that touches monthly data, so the very first request of a
 * new month rolls the group over — even if no cron ever fires. The cron
 * tick (/api/cron/tick) exists so the rollover also happens when nobody
 * visits, and to pre-generate next month's bazar schedule.
 */

export type GroupDoc = HydratedDocument<IGroup>;

/**
 * Roll the group into the current month if its state is stale.
 * Returns true if a rollover (auto-reset) happened.
 */
export async function ensureCurrentCycle(group: GroupDoc): Promise<boolean> {
  const month = currentMonth();
  if (group.mealSystem?.month === month) return false;

  group.mealSystem = {
    status: "ACTIVE",
    month,
    cycleStart: firstDayOfMonth(month),
    frozenAt: null,
  };
  await group.save();
  return true;
}

/**
 * Guard used by every WRITE route that touches monthly data (meal
 * cancellations, expenses, deposits): loads the group, rolls it into the
 * current month if needed, and rejects the request while FROZEN.
 */
export async function requireActiveSystem(
  groupId: Types.ObjectId | null
): Promise<GroupDoc> {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(404, "Your group no longer exists");
  await ensureCurrentCycle(group);
  assertSystemActive(group);
  return group;
}

/** Guard: throw 423 (Locked) when the admin has frozen the meal system. */
export function assertSystemActive(group: GroupDoc): void {
  if (group.mealSystem?.status === "FROZEN") {
    throw new ApiError(
      423,
      "The meal system is frozen by the admin — no changes until it is reset"
    );
  }
}

/**
 * The billing window for a month, honouring resets and freezes:
 *   start = cycleStart      (the 1st, or the hard-reset day)
 *   end   = min(today, month end, freeze day)
 * "Strictly up to today" — future days are NEVER counted.
 */
export function billingWindow(
  group: GroupDoc,
  month: string
): { from: string; upTo: string } {
  const today = todayInAppTz();
  const sys = group.mealSystem;

  const from =
    sys?.month === month && sys.cycleStart
      ? sys.cycleStart
      : firstDayOfMonth(month);

  let upTo = minDate(today, lastDayOfMonth(month));
  if (sys?.month === month && sys.status === "FROZEN" && sys.frozenAt) {
    upTo = minDate(upTo, sys.frozenAt);
  }
  return { from, upTo };
}
