import { ApiError } from "./api";
import { addDays, currentHourInAppTz, todayInAppTz } from "./dates";
import type { CancellationType } from "@/models/MealCancellation";

/**
 * MEAL RULES
 * ───────────
 * The strict cutoff rule: cancellations (and un-cancellations) for day D
 * must be submitted BY THE PREVIOUS DAY. Concretely:
 *
 *   - D is today or in the past  → ❌ always rejected
 *   - D is tomorrow              → ✅ only BEFORE the cutoff hour today
 *                                   (MEAL_CANCEL_CUTOFF_HOUR, default 22 = 10 PM)
 *   - D is later than tomorrow   → ✅ always allowed
 *
 * All checks run in APP_TIMEZONE, on the server — the client UI also hides
 * invalid dates, but the API is the real gatekeeper.
 */

export function cutoffHour(): number {
  const h = Number(process.env.MEAL_CANCEL_CUTOFF_HOUR ?? 22);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 22;
}

export function assertBeforeCutoff(date: string): void {
  const today = todayInAppTz();

  if (date <= today) {
    throw new ApiError(
      400,
      "Too late — meal changes must be made by the previous day"
    );
  }

  const tomorrow = addDays(today, 1);
  if (date === tomorrow && currentHourInAppTz() >= cutoffHour()) {
    throw new ApiError(
      400,
      `Too late — changes for tomorrow close at ${cutoffHour()}:00 today`
    );
  }
}

/** How many meal slots does a cancellation remove? FULL = both meals. */
export function cancelledSlots(type: CancellationType): number {
  return type === "FULL" ? 2 : 1;
}
