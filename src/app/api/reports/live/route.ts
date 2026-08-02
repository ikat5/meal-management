import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import { billingWindow, ensureCurrentCycle } from "@/lib/system";
import { calculateReport } from "@/lib/report";
import Group from "@/models/Group";
import User from "@/models/User";

/**
 * GET /api/reports/live — the REAL-TIME ledger, recomputed on every call.
 *
 * Nothing is stored: the math strictly counts expenses, deposits and
 * meals from the cycle start UP TO TODAY (or up to the freeze date if the
 * admin froze the system). Tomorrow's meals don't exist yet, so the
 * per-meal rate moves day by day as the month progresses.
 */
export const GET = apiHandler(async () => {
  await dbConnect();
  const user = await requireGroupMember();

  const group = await Group.findById(user.groupId);
  if (!group) throw new ApiError(404, "Your group no longer exists");
  await ensureCurrentCycle(group); // auto-rollover on the 1st

  const month = currentMonth();
  const window = billingWindow(group, month);
  const data = await calculateReport(group._id, month, window);

  // Attach names so the client doesn't need a second request
  const users = await User.find({
    _id: { $in: data.rows.map((r) => r.user) },
  }).select("name");
  const names = new Map(users.map((u) => [String(u._id), u.name]));

  return ok({
    month,
    window,
    mealSystem: group.mealSystem,
    report: {
      ...data,
      rows: data.rows.map((r) => ({
        ...r,
        user: { _id: r.user, name: names.get(String(r.user)) ?? "Unknown" },
      })),
    },
  });
});
