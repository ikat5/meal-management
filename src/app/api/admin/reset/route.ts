import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupAdmin } from "@/lib/auth";
import { currentMonth, firstDayOfMonth, lastDayOfMonth, todayInAppTz } from "@/lib/dates";
import { ensureCurrentCycle } from "@/lib/system";
import Expense from "@/models/Expense";
import Deposit from "@/models/Deposit";
import MealCancellation from "@/models/MealCancellation";
import MarketSchedule from "@/models/MarketSchedule";
import MonthlyReport from "@/models/MonthlyReport";
import SwapRequest from "@/models/SwapRequest";

/**
 * POST /api/admin/reset — ADMIN ONLY, and only while FROZEN.
 *
 * The "HARD RESET": wipes the CURRENT month's data and restarts the meal
 * system from scratch, today:
 *   - deletes this month's expenses, deposits, meal cancellations,
 *     bazar schedule, swap requests and any report snapshot
 *   - unfreezes the system
 *   - moves the billing cycle start to TODAY, so the fresh ledger begins
 *     at zero meals / zero cost
 *
 * Requiring FROZEN first is deliberate friction — a two-step confirmation
 * for an irreversible action.
 */
export const POST = apiHandler(async () => {
  await dbConnect();
  const { group } = await requireGroupAdmin();
  await ensureCurrentCycle(group);

  if (group.mealSystem.status !== "FROZEN") {
    throw new ApiError(409, "Freeze the meal system first — Hard Reset is only available while frozen");
  }

  const month = currentMonth();
  const inMonth = { $gte: firstDayOfMonth(month), $lte: lastDayOfMonth(month) };

  const [expenses, deposits, cancellations, schedules, swaps, reports] =
    await Promise.all([
      Expense.deleteMany({ group: group._id, date: inMonth }),
      Deposit.deleteMany({ group: group._id, date: inMonth }),
      MealCancellation.deleteMany({ group: group._id, date: inMonth }),
      MarketSchedule.deleteMany({ group: group._id, month }),
      SwapRequest.deleteMany({ group: group._id }),
      MonthlyReport.deleteMany({ group: group._id, month }),
    ]);

  group.mealSystem = {
    status: "ACTIVE",
    month,
    cycleStart: todayInAppTz(), // the new cycle starts NOW, not on the 1st
    frozenAt: null,
  };
  await group.save();

  return ok({
    mealSystem: group.mealSystem,
    deleted: {
      expenses: expenses.deletedCount,
      deposits: deposits.deletedCount,
      cancellations: cancellations.deletedCount,
      schedules: schedules.deletedCount,
      swapRequests: swaps.deletedCount,
      reports: reports.deletedCount,
    },
  });
});
