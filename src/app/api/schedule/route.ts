import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import MarketSchedule from "@/models/MarketSchedule";

/** GET /api/schedule?month=2026-08 — the bazar roster (defaults to this month) */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "month must look like 2026-08");

  const schedule = await MarketSchedule.findOne({
    group: user.groupId,
    month,
  }).populate("assignments.user", "name");

  if (!schedule) {
    throw new ApiError(404, `No schedule generated yet for ${month}`);
  }

  return ok({ schedule });
});
