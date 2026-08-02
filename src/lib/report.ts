import { Types } from "mongoose";
import { ApiError } from "./api";
import { dateStrInAppTz, maxDate, monthDates } from "./dates";
import { cancelledSlots } from "./meals";
import Group from "@/models/Group";
import Expense from "@/models/Expense";
import Deposit from "@/models/Deposit";
import MealCancellation from "@/models/MealCancellation";

/**
 * BILLING MATH (shared by the LIVE report and the end-of-month snapshot)
 * ───────────────────────────────────────────────────────────────────────
 *   totalCost   = Σ market expenses inside the window
 *   totalMeals  = Σ over members: (their active days × 2) − cancelled slots
 *   perMealRate = totalCost / totalMeals
 *   per member:
 *     mealCost = mealsConsumed × perMealRate
 *     balance  = deposits − mealCost   (+ group owes them, − they owe group)
 *
 * THE WINDOW is the key idea. Instead of always billing the whole month,
 * the caller passes { from, upTo }:
 *   - live report        → from = cycle start, upTo = today (or freeze day)
 *   - month-end snapshot → from = cycle start, upTo = last day of month
 * Every query and every member's "active days" is clamped to it, which is
 * what makes the report strictly "up to today" — a day that hasn't
 * happened yet contributes zero meals and zero cost.
 *
 * Fairness detail: a member's active days also start at their JOIN DATE,
 * so someone who joined on the 15th isn't billed for the 1st–14th.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ReportRowData {
  user: Types.ObjectId;
  mealsConsumed: number;
  mealCost: number;
  deposits: number;
  balance: number;
}

export interface ReportData {
  totalCost: number;
  totalMeals: number;
  perMealRate: number;
  rows: ReportRowData[];
}

export interface ReportWindow {
  from: string; // "YYYY-MM-DD" inclusive
  upTo: string; // "YYYY-MM-DD" inclusive
}

export async function calculateReport(
  groupId: Types.ObjectId,
  month: string, // "YYYY-MM"
  window: ReportWindow
): Promise<ReportData> {
  const group = await Group.findById(groupId);
  if (!group) throw new ApiError(404, "Group not found");

  // Days of the month that fall inside the window (empty if upTo < from,
  // e.g. asking for a live report of a future month)
  const days = monthDates(month).filter(
    (d) => d >= window.from && d <= window.upTo
  );

  const inWindow = { $gte: window.from, $lte: window.upTo };

  // One query each — then everything else is plain JavaScript
  const [expenses, deposits, cancellations] = await Promise.all([
    Expense.find({ group: groupId, date: inWindow }),
    Deposit.find({ group: groupId, date: inWindow }),
    MealCancellation.find({ group: groupId, date: inWindow }),
  ]);

  const totalCost = round2(expenses.reduce((sum, e) => sum + e.totalAmount, 0));

  const rows: ReportRowData[] = [];
  let totalMeals = 0;

  for (const member of group.members) {
    const userId = String(member.user);

    // Active days: window clamped again by the member's join date
    const memberStart = maxDate(window.from, dateStrInAppTz(member.joinedAt));
    const activeDays = days.filter((d) => d >= memberStart).length;

    // Cancelled slots within their active window
    const cancelledCount = cancellations
      .filter((c) => String(c.user) === userId && c.date >= memberStart)
      .reduce((sum, c) => sum + cancelledSlots(c.type), 0);

    // 2 meals/day by default; a cancellation is the ONLY thing that
    // subtracts from it
    const mealsConsumed = Math.max(0, activeDays * 2 - cancelledCount);
    totalMeals += mealsConsumed;

    const userDeposits = round2(
      deposits
        .filter((d) => String(d.user) === userId)
        .reduce((sum, d) => sum + d.amount, 0)
    );

    rows.push({
      user: member.user,
      mealsConsumed,
      mealCost: 0, // filled in below, once we know the per-meal rate
      deposits: userDeposits,
      balance: 0,
    });
  }

  const perMealRate = totalMeals > 0 ? round2(totalCost / totalMeals) : 0;

  for (const row of rows) {
    row.mealCost = round2(row.mealsConsumed * perMealRate);
    row.balance = round2(row.deposits - row.mealCost);
  }

  return { totalCost, totalMeals, perMealRate, rows };
}

/**
 * Whole-month report (used by the admin's end-of-month snapshot).
 * Kept for backwards compatibility with /api/reports/generate.
 */
export async function calculateMonthlyReport(
  groupId: Types.ObjectId,
  month: string
): Promise<ReportData> {
  const days = monthDates(month);
  return calculateReport(groupId, month, {
    from: days[0],
    upTo: days[days.length - 1],
  });
}
